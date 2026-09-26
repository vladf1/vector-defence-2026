import {
  ACESFilmicToneMapping,
  HalfFloatType,
  Mesh,
  NodeMaterial,
  OrthographicCamera,
  QuadMesh,
  RenderTarget,
  SRGBColorSpace,
  Texture,
  Vector2,
  type Camera,
  type Material,
  type Scene,
  type UniformNode,
  type WebGPURenderer,
} from "three/webgpu";
import { float, length, max, positionGeometry, renderOutput, screenUV, smoothstep, texture, uniform, uv, vec2, vec4 } from "three/tsl";

const BLOOM_THRESHOLD = 0.85;
const BLOOM_STRENGTH = 0.8;
const FINE_BLOOM_WEIGHT = 0.9;
const WIDE_BLOOM_WEIGHT = 1.2;
const VIGNETTE_STRENGTH = 0.4;
// Linear-sampled 9-tap Gaussian: three fetches per side collapsed into two bilinear taps.
const BLUR_OFFSETS = [1.3846153846, 3.2307692308] as const;
const BLUR_WEIGHTS = [0.2270270270, 0.3162162162, 0.0702702703] as const;

// three's full-screen triangle (with its uv convention). Passes use plain meshes over it:
// QuadMesh.render() swaps in a private vertex shader, so a precompiled QuadMesh never matches.
const FULLSCREEN_GEOMETRY = new QuadMesh(new NodeMaterial()).geometry;
const FULLSCREEN_CAMERA = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

function createFullscreenMesh(material: NodeMaterial): Mesh {
  material.vertexNode = vec4(positionGeometry.xy, 0, 1);
  material.depthTest = false;
  material.depthWrite = false;
  const mesh = new Mesh(FULLSCREEN_GEOMETRY, material);
  mesh.frustumCulled = false;
  return mesh;
}

interface SampledPass {
  readonly quad: Mesh;
  readonly source: ReturnType<typeof texture>;
  readonly texelSize: UniformNode<"vec2", Vector2>;
}

function createHalfFloatTarget(samples: number, depthBuffer: boolean): RenderTarget {
  return new RenderTarget(1, 1, { type: HalfFloatType, samples, depthBuffer });
}

/**
 * 4-tap box downsample (16-texel footprint) with a soft brightness threshold. The threshold
 * is a uniform (0 = plain downsample) so every instance compiles to the same shader.
 */
function createDownsamplePass(threshold: number, shaderSalt: number): SampledPass {
  const source = texture(new Texture());
  const texelSize = uniform(new Vector2(1, 1));
  const thresholdValue = uniform(threshold);
  const coordinate = uv();
  const sample = (x: number, y: number) => source.sample(coordinate.add(texelSize.mul(vec2(x, y))));
  const average = sample(-1, -1).add(sample(1, -1)).add(sample(-1, 1)).add(sample(1, 1)).mul(0.25).rgb;
  const brightness = max(max(average.r, average.g), average.b);
  const color = average.mul(max(brightness.sub(thresholdValue), 0).div(max(brightness, 1e-4))).add(shaderSalt * 1e-12);
  const material = new NodeMaterial();
  material.name = "bloom-downsample";
  material.fragmentNode = vec4(color, 1);
  return { quad: createFullscreenMesh(material), source, texelSize };
}

/** One direction of a separable Gaussian blur; the direction is a uniform so all blurs share a shader. */
function createBlurPass(direction: Vector2, shaderSalt: number): SampledPass {
  const source = texture(new Texture());
  const texelSize = uniform(new Vector2(1, 1));
  const coordinate = uv();
  const step = texelSize.mul(uniform(direction));
  let color = source.sample(coordinate).rgb.mul(BLUR_WEIGHTS[0]).add(shaderSalt * 1e-12);
  BLUR_OFFSETS.forEach((offset, index) => {
    const delta = step.mul(offset);
    color = color.add(source.sample(coordinate.add(delta)).rgb.add(source.sample(coordinate.sub(delta)).rgb).mul(BLUR_WEIGHTS[index + 1]));
  });
  const material = new NodeMaterial();
  material.name = "bloom-blur";
  material.fragmentNode = vec4(color, 1);
  return { quad: createFullscreenMesh(material), source, texelSize };
}

/**
 * Lean HDR bloom: scene -> 1/4 prefilter -> blur -> 1/8 -> blur, composited with ACES tone
 * mapping, sRGB encoding, and a vignette straight onto the canvas. Only three distinct
 * shaders (prefilter/downsample share one, the blurs share one, plus the composite), all
 * precompiled asynchronously; three's BloomNode needs ~9 pipelines built synchronously.
 */
export class PostProcessing {
  readonly sceneTarget: RenderTarget;
  private readonly fineTarget = createHalfFloatTarget(0, false);
  private readonly fineScratch = createHalfFloatTarget(0, false);
  private readonly wideTarget = createHalfFloatTarget(0, false);
  private readonly wideScratch = createHalfFloatTarget(0, false);
  private readonly prefilter: SampledPass;
  private readonly downsample: SampledPass;
  private readonly fineHorizontal: SampledPass;
  private readonly fineVertical: SampledPass;
  private readonly wideHorizontal: SampledPass;
  private readonly wideVertical: SampledPass;
  private readonly composite: Mesh;
  private readonly drawingSize = new Vector2();

  /** `shaderSalt` is the benchmark aid from materials.ts (0 in production). */
  constructor(private readonly renderer: WebGPURenderer, msaaSamples: number, private readonly bloomResolution: number, shaderSalt: number) {
    this.prefilter = createDownsamplePass(BLOOM_THRESHOLD, shaderSalt);
    this.downsample = createDownsamplePass(0, shaderSalt);
    this.fineHorizontal = createBlurPass(new Vector2(1, 0), shaderSalt);
    this.fineVertical = createBlurPass(new Vector2(0, 1), shaderSalt);
    this.wideHorizontal = createBlurPass(new Vector2(1, 0), shaderSalt);
    this.wideVertical = createBlurPass(new Vector2(0, 1), shaderSalt);
    this.sceneTarget = createHalfFloatTarget(msaaSamples, true);
    const sceneColor = texture(this.sceneTarget.texture);
    const fineBloom = texture(this.fineTarget.texture);
    const wideBloom = texture(this.wideTarget.texture);
    const bloom = fineBloom.sample(uv()).rgb.mul(FINE_BLOOM_WEIGHT).add(wideBloom.sample(uv()).rgb.mul(WIDE_BLOOM_WEIGHT));
    const vignette = float(1).sub(smoothstep(0.38, 0.98, length(screenUV.sub(0.5).mul(vec2(1.12, 1)))).mul(VIGNETTE_STRENGTH));
    const color = sceneColor.sample(uv()).rgb.add(bloom.mul(BLOOM_STRENGTH)).mul(vignette).add(shaderSalt * 1e-12);
    const material = new NodeMaterial();
    material.name = "post-composite";
    material.fragmentNode = renderOutput(vec4(color, 1), ACESFilmicToneMapping, SRGBColorSpace);
    this.composite = createFullscreenMesh(material);

    this.prefilter.source.value = this.sceneTarget.texture;
    this.fineHorizontal.source.value = this.fineTarget.texture;
    this.fineVertical.source.value = this.fineScratch.texture;
    this.downsample.source.value = this.fineTarget.texture;
    this.wideHorizontal.source.value = this.wideTarget.texture;
    this.wideVertical.source.value = this.wideScratch.texture;
  }

  /** Matches every target to the renderer's current drawing-buffer size. */
  resize(): void {
    const size = this.renderer.getDrawingBufferSize(this.drawingSize);
    const width = Math.max(1, size.x);
    const height = Math.max(1, size.y);
    this.sceneTarget.setSize(width, height);
    const fineWidth = Math.max(1, Math.round(width * this.bloomResolution * 0.5));
    const fineHeight = Math.max(1, Math.round(height * this.bloomResolution * 0.5));
    const wideWidth = Math.max(1, Math.round(fineWidth / 2));
    const wideHeight = Math.max(1, Math.round(fineHeight / 2));
    this.fineTarget.setSize(fineWidth, fineHeight);
    this.fineScratch.setSize(fineWidth, fineHeight);
    this.wideTarget.setSize(wideWidth, wideHeight);
    this.wideScratch.setSize(wideWidth, wideHeight);
    this.prefilter.texelSize.value.set(1 / width, 1 / height);
    this.fineHorizontal.texelSize.value.set(1 / fineWidth, 1 / fineHeight);
    this.fineVertical.texelSize.value.set(1 / fineWidth, 1 / fineHeight);
    this.downsample.texelSize.value.set(1 / fineWidth, 1 / fineHeight);
    this.wideHorizontal.texelSize.value.set(1 / wideWidth, 1 / wideHeight);
    this.wideVertical.texelSize.value.set(1 / wideWidth, 1 / wideHeight);
  }

  render(scene: Scene, camera: Camera): void {
    const renderer = this.renderer;
    renderer.setRenderTarget(this.sceneTarget);
    renderer.render(scene, camera);
    this.renderPass(this.prefilter.quad, this.fineTarget);
    this.renderPass(this.fineHorizontal.quad, this.fineScratch);
    this.renderPass(this.fineVertical.quad, this.fineTarget);
    this.renderPass(this.downsample.quad, this.wideTarget);
    this.renderPass(this.wideHorizontal.quad, this.wideScratch);
    this.renderPass(this.wideVertical.quad, this.wideTarget);
    this.renderPass(this.composite, null);
  }

  /** Starts async pipeline builds for every post pass, each against its real target format. */
  compileAsync(): Promise<unknown> {
    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const jobs: Promise<unknown>[] = [];
    const start = (mesh: Mesh, target: RenderTarget | null): void => {
      renderer.setRenderTarget(target);
      jobs.push(renderer.compileAsync(mesh, FULLSCREEN_CAMERA));
    };
    start(this.prefilter.quad, this.fineTarget);
    start(this.fineHorizontal.quad, this.fineScratch);
    start(this.composite, null);
    renderer.setRenderTarget(previousTarget);
    return Promise.all(jobs);
  }

  dispose(): void {
    for (const target of [this.sceneTarget, this.fineTarget, this.fineScratch, this.wideTarget, this.wideScratch]) {
      target.dispose();
    }
    for (const quad of [this.prefilter.quad, this.downsample.quad, this.fineHorizontal.quad, this.fineVertical.quad, this.wideHorizontal.quad, this.wideVertical.quad, this.composite]) {
      (quad.material as Material).dispose();
    }
  }

  private renderPass(mesh: Mesh, target: RenderTarget | null): void {
    this.renderer.setRenderTarget(target);
    this.renderer.render(mesh, FULLSCREEN_CAMERA);
  }
}
