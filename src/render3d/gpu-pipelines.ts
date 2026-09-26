import {
  BLUR_SHADER,
  COMPOSITE_SHADER,
  DECAL_SHADER,
  DOWNSAMPLE_SHADER,
  GLOW_SPRITE_SHADER,
  GROUND_GLOW_SHADER,
  GROUND_SHADER,
  HEALTH_BAR_SHADER,
  NEON_SHADER,
  RANGE_SHADER,
  RIBBON_SHADER,
  ROAD_SHADER,
  SMOKE_SPRITE_SHADER,
} from "./shaders";
import { NEON_VERTEX_FLOATS } from "./geometry-kit";
import { ShaderStage } from "./gpu-flags";

export const HDR_FORMAT: GPUTextureFormat = "rgba16float";
export const DEPTH_FORMAT: GPUTextureFormat = "depth24plus";
export const PUFF_FORMAT: GPUTextureFormat = "r8unorm";

/** Floats per instance: column-major transform (16), tint (4), extras (4). */
export const INSTANCE_FLOATS = 24;
/** Floats per sprite: position + rotation (4), size + shape (4), color (4). */
export const SPRITE_FLOATS = 12;
export const FLAT_VERTEX_FLOATS = 5;

export interface ScenePipelines {
  readonly neon: GPURenderPipeline;
  readonly ground: GPURenderPipeline;
  readonly road: GPURenderPipeline;
  readonly ribbon: GPURenderPipeline;
  readonly decal: GPURenderPipeline;
  readonly healthBar: GPURenderPipeline;
  readonly range: GPURenderPipeline;
  readonly groundGlow: GPURenderPipeline;
  readonly glowSprite: GPURenderPipeline;
  readonly smokeSprite: GPURenderPipeline;
}

export interface PostPipelines {
  readonly downsample: GPURenderPipeline;
  readonly blur: GPURenderPipeline;
  readonly composite: GPURenderPipeline;
}

export interface GpuPipelines {
  readonly frameLayout: GPUBindGroupLayout;
  readonly passLayout: GPUBindGroupLayout;
  readonly compositeLayout: GPUBindGroupLayout;
  readonly scene: ScenePipelines;
  readonly post: PostPipelines;
}

const FLOAT_BYTES = 4;

const INSTANCE_BUFFER: GPUVertexBufferLayout = {
  arrayStride: INSTANCE_FLOATS * FLOAT_BYTES,
  stepMode: "instance",
  attributes: [3, 4, 5, 6, 7, 8].map((shaderLocation, index) => ({ shaderLocation, offset: index * 16, format: "float32x4" as const })),
};

const NEON_VERTEX_BUFFER: GPUVertexBufferLayout = {
  arrayStride: NEON_VERTEX_FLOATS * FLOAT_BYTES,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32" },
  ],
};

const FLAT_VERTEX_BUFFER: GPUVertexBufferLayout = {
  arrayStride: FLAT_VERTEX_FLOATS * FLOAT_BYTES,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x2" },
  ],
};

const SPRITE_BUFFER: GPUVertexBufferLayout = {
  arrayStride: SPRITE_FLOATS * FLOAT_BYTES,
  stepMode: "instance",
  attributes: [0, 1, 2].map((shaderLocation) => ({ shaderLocation, offset: shaderLocation * 16, format: "float32x4" as const })),
};

const ADDITIVE: GPUBlendState = {
  color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
};

const NORMAL: GPUBlendState = {
  color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
};

type DepthMode = "opaque" | "transparent" | "overlay";

const DEPTH_MODES: Record<DepthMode, GPUDepthStencilState> = {
  opaque: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less-equal" },
  transparent: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "less-equal" },
  overlay: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "always" },
};

/**
 * Benchmark aid: a nonzero salt adds an inert constant to every fragment output so GPU
 * driver shader caches miss, making first-visit compile cost measurable on demand.
 */
function saltShader(code: string, salt: number): string {
  if (salt === 0) {
    return code;
  }
  return `${code.replace("@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f", "fn fragmentBody(in: Varying) -> vec4f")}
@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  return fragmentBody(in) + vec4f(${salt.toFixed(1)} * 1e-12);
}
`;
}

export function createFrameLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: "frame",
    entries: [
      { binding: 0, visibility: ShaderStage.VERTEX | ShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: ShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 2, visibility: ShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });
}

/**
 * Starts every pipeline the board will ever use at once. Async creation lets the driver
 * compile them in parallel, and nothing compiles after startup: materials never vary per
 * entity (instance data carries identity), so this fixed set covers the whole game.
 */
export async function createPipelines(device: GPUDevice, canvasFormat: GPUTextureFormat, sampleCount: number, shaderSalt: number): Promise<GpuPipelines> {
  const frameLayout = createFrameLayout(device);
  const passLayout = device.createBindGroupLayout({
    label: "post-pass",
    entries: [
      { binding: 0, visibility: ShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 1, visibility: ShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 2, visibility: ShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ],
  });
  const compositeLayout = device.createBindGroupLayout({
    label: "post-composite",
    entries: [
      { binding: 0, visibility: ShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 1, visibility: ShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 2, visibility: ShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 3, visibility: ShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });
  const sceneLayout = device.createPipelineLayout({ bindGroupLayouts: [frameLayout] });
  const multisample: GPUMultisampleState = { count: Math.max(1, sampleCount) };

  const scene = (
    label: string,
    code: string,
    buffers: GPUVertexBufferLayout[],
    depth: DepthMode,
    blend: GPUBlendState | undefined,
  ): Promise<GPURenderPipeline> => {
    const module = device.createShaderModule({ label, code: saltShader(code, shaderSalt) });
    return device.createRenderPipelineAsync({
      label,
      layout: sceneLayout,
      vertex: { module, entryPoint: "vertexMain", buffers },
      fragment: { module, entryPoint: "fragmentMain", targets: [{ format: HDR_FORMAT, blend }] },
      primitive: { topology: "triangle-list", cullMode: "back", frontFace: "ccw" },
      depthStencil: DEPTH_MODES[depth],
      multisample,
    });
  };

  const post = (label: string, code: string, layout: GPUBindGroupLayout, format: GPUTextureFormat): Promise<GPURenderPipeline> => {
    const module = device.createShaderModule({ label, code: saltShader(code, shaderSalt) });
    return device.createRenderPipelineAsync({
      label,
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: { module, entryPoint: "vertexMain" },
      fragment: { module, entryPoint: "fragmentMain", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });
  };

  const instancedFlat = [FLAT_VERTEX_BUFFER, INSTANCE_BUFFER];
  const [
    neon,
    ground,
    road,
    ribbon,
    decal,
    healthBar,
    range,
    groundGlow,
    glowSprite,
    smokeSprite,
    downsample,
    blur,
    composite,
  ] = await Promise.all([
    scene("neon", NEON_SHADER, [NEON_VERTEX_BUFFER, INSTANCE_BUFFER], "opaque", undefined),
    scene("ground", GROUND_SHADER, [], "opaque", undefined),
    scene("road", ROAD_SHADER, [FLAT_VERTEX_BUFFER], "opaque", undefined),
    scene("ribbon", RIBBON_SHADER, instancedFlat, "transparent", ADDITIVE),
    scene("decal", DECAL_SHADER, instancedFlat, "transparent", NORMAL),
    scene("health-bar", HEALTH_BAR_SHADER, instancedFlat, "overlay", undefined),
    scene("range", RANGE_SHADER, instancedFlat, "transparent", ADDITIVE),
    scene("ground-glow", GROUND_GLOW_SHADER, instancedFlat, "transparent", ADDITIVE),
    scene("glow-sprite", GLOW_SPRITE_SHADER, [SPRITE_BUFFER], "transparent", ADDITIVE),
    scene("smoke-sprite", SMOKE_SPRITE_SHADER, [SPRITE_BUFFER], "transparent", NORMAL),
    post("bloom-downsample", DOWNSAMPLE_SHADER, passLayout, HDR_FORMAT),
    post("bloom-blur", BLUR_SHADER, passLayout, HDR_FORMAT),
    post("post-composite", COMPOSITE_SHADER, compositeLayout, canvasFormat),
  ]);

  return {
    frameLayout,
    passLayout,
    compositeLayout,
    scene: { neon, ground, road, ribbon, decal, healthBar, range, groundGlow, glowSprite, smokeSprite },
    post: { downsample, blur, composite },
  };
}
