import {
  AdditiveBlending,
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  NormalBlending,
  SpriteNodeMaterial,
  type Node,
  type NodeMaterial,
  type Texture,
  type UniformNode,
} from "three/webgpu";
import {
  Fn,
  TWO_PI,
  abs,
  atan,
  attribute,
  cameraViewMatrix,
  dot,
  float,
  floor,
  fract,
  fwidth,
  instancedDynamicBufferAttribute,
  length,
  mat4,
  min,
  mix,
  mod,
  normalLocal,
  normalView,
  normalize,
  positionLocal,
  positionViewDirection,
  positionWorld,
  pow,
  saturate,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { SpriteBatchAttributes } from "./sprite-batch";

/**
 * The whole 3D board renders with this fixed material set. Every entity part shares
 * `neon`, so gameplay variety never adds shader programs; per-instance color carries identity.
 */
export interface MaterialSet {
  readonly neon: MeshLambertNodeMaterial;
  readonly ground: MeshLambertNodeMaterial;
  readonly road: MeshLambertNodeMaterial;
  readonly ribbon: MeshBasicNodeMaterial;
  readonly decal: MeshBasicNodeMaterial;
  readonly healthBar: MeshBasicNodeMaterial;
  readonly range: MeshBasicNodeMaterial;
  readonly groundGlow: MeshBasicNodeMaterial;
  createGlowSprite(attributes: SpriteBatchAttributes): SpriteNodeMaterial;
  createSmokeSprite(attributes: SpriteBatchAttributes): SpriteNodeMaterial;
}

export interface MaterialUniforms {
  readonly time: UniformNode<"float", number>;
  readonly roadHalfWidth: UniformNode<"float", number>;
  readonly fieldWidth: UniformNode<"float", number>;
  readonly fieldHeight: UniformNode<"float", number>;
}

const GRID_SPACING = 35;
/** Toward the key light (matches the renderer's sun placement). */
const KEY_LIGHT_DIRECTION = vec3(-0.33, 0.85, -0.44).normalize();

/**
 * Lit materials here are Lambert: the look is carried by emissive trims, rims, and bloom,
 * and the full PBR model compiles markedly slower on first launch. NodeMaterial lighting
 * honors `emissiveNode` for every lit material, but the Lambert typings omit it.
 */
function setEmissive(material: MeshLambertNodeMaterial, node: Node): void {
  (material as unknown as { emissiveNode: Node }).emissiveNode = node;
}

/**
 * Applies a batch's per-instance transform (see InstancedBatch) in the vertex stage.
 * Instance matrices are rotation x scale, so dividing each column by its squared length
 * gives the exact inverse-transpose for normals without a per-vertex matrix inverse.
 */
function createInstancedPositionNode() {
  return Fn(() => {
    const column0 = attribute("instanceMatrix0", "vec4");
    const column1 = attribute("instanceMatrix1", "vec4");
    const column2 = attribute("instanceMatrix2", "vec4");
    const column3 = attribute("instanceMatrix3", "vec4");
    const axisX = column0.xyz;
    const axisY = column1.xyz;
    const axisZ = column2.xyz;
    normalLocal.assign(normalize(
      axisX.mul(normalLocal.x.div(dot(axisX, axisX).add(1e-8)))
        .add(axisY.mul(normalLocal.y.div(dot(axisY, axisY).add(1e-8))))
        .add(axisZ.mul(normalLocal.z.div(dot(axisZ, axisZ).add(1e-8)))),
    ));
    return mat4(column0, column1, column2, column3).mul(vec4(positionLocal, 1)).xyz;
  })();
}

function instanceTint() {
  return attribute("instanceTint", "vec3");
}

function instanceExtra() {
  return attribute("instanceExtra", "vec4");
}
const CHEVRON_SPACING = 30;
const CHEVRON_SPEED_PER_SECOND = 22;

export function createMaterialUniforms(fieldWidth: number, fieldHeight: number, roadWidth: number): MaterialUniforms {
  return {
    time: uniform(0),
    roadHalfWidth: uniform(roadWidth / 2),
    fieldWidth: uniform(fieldWidth),
    fieldHeight: uniform(fieldHeight),
  };
}

function createNeonMaterial(): MeshLambertNodeMaterial {
  const material = new MeshLambertNodeMaterial();
  material.name = "neon";
  const glow = attribute("glow", "float");
  const tint = instanceTint();
  const facing = saturate(dot(normalView, positionViewDirection));
  const rim = pow(float(1).sub(facing), 2.6);
  // Cheap Blinn highlight from the key light keeps dark bodies glossy.
  const keyLight = normalize(cameraViewMatrix.mul(vec4(KEY_LIGHT_DIRECTION, 0)).xyz);
  const highlight = pow(saturate(dot(normalView, normalize(keyLight.add(positionViewDirection)))), 36)
    .mul(float(1).sub(glow));
  material.positionNode = createInstancedPositionNode();
  // Dark tinted bodies, bright glowing trims.
  material.colorNode = tint.mul(mix(float(0.032), float(1), glow));
  setEmissive(material, tint.mul(glow.mul(1.25).add(rim.mul(0.6))).add(highlight.mul(0.3)));
  return material;
}

// Lambert keeps the vast floor near-black under the key light (no specular sheen) and
// is the cheapest lit shading, while still catching explosion flashes and shadows.
function createGroundMaterial(uniforms: MaterialUniforms): MeshLambertNodeMaterial {
  const material = new MeshLambertNodeMaterial();
  material.name = "ground";
  const field = positionWorld.xz;
  const cell = field.div(GRID_SPACING);
  const cellLine = abs(fract(cell.sub(0.5)).sub(0.5)).div(fwidth(cell));
  const minorLine = float(1).sub(min(min(cellLine.x, cellLine.y), 1));
  const majorCell = field.div(GRID_SPACING * 5);
  const majorLineDistance = abs(fract(majorCell.sub(0.5)).sub(0.5)).div(fwidth(majorCell));
  const majorLine = float(1).sub(min(min(majorLineDistance.x, majorLineDistance.y), 1));
  const cellId = floor(cell);
  const panelNoise = fract(sin(dot(cellId, vec2(12.9898, 78.233))).mul(43758.5453));
  const fieldCenter = vec2(uniforms.fieldWidth, uniforms.fieldHeight).mul(0.5);
  const focusDistance = length(field.sub(fieldCenter).div(vec2(uniforms.fieldWidth, uniforms.fieldHeight).mul(0.64)));
  const focus = float(1).sub(smoothstep(0.62, 1.55, focusDistance));
  const panelShade = panelNoise.mul(0.28).add(0.86);
  material.colorNode = vec3(0.0045, 0.0095, 0.008).mul(panelShade).mul(focus.mul(0.6).add(0.4));
  setEmissive(material, vec3(0.004, 0.02, 0.016)
    .mul(minorLine.mul(0.75).add(majorLine.mul(0.9)))
    .mul(focus.mul(0.8).add(0.2)));
  return material;
}

function createRoadMaterial(uniforms: MaterialUniforms): MeshLambertNodeMaterial {
  const material = new MeshLambertNodeMaterial();
  material.name = "road";
  const along = uv().x;
  const across = abs(uv().y);
  const edge = smoothstep(0.8, 0.9, across).mul(float(1).sub(smoothstep(0.95, 1, across)));
  const channelShade = mix(float(1), float(0.5), smoothstep(0.25, 0.92, across));
  const chevronPhase = fract(
    along.add(across.mul(uniforms.roadHalfWidth).mul(0.85)).div(CHEVRON_SPACING)
      .sub(uniforms.time.mul(CHEVRON_SPEED_PER_SECOND / CHEVRON_SPACING)),
  );
  const chevron = smoothstep(0, 0.05, chevronPhase)
    .mul(float(1).sub(smoothstep(0.09, 0.2, chevronPhase)))
    .mul(float(1).sub(smoothstep(0.42, 0.66, across)));
  material.colorNode = vec3(0.0035, 0.024, 0.02).mul(channelShade);
  setEmissive(material, vec3(0.018, 0.15, 0.115).mul(edge)
    .add(vec3(0.03, 0.2, 0.15).mul(chevron.mul(0.22))));
  return material;
}

function createRibbonMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  // Single-sided on purpose: writers always face ribbons toward the camera, and a
  // transparent DoubleSide material would render in two passes with two extra pipelines.
  material.name = "ribbon";
  const tailFade = instanceExtra().x;
  const across = abs(uv().y.sub(0.5)).mul(2);
  const glow = pow(saturate(float(1).sub(across)), 2.2);
  const core = smoothstep(0.38, 0, across);
  const tail = mix(float(1), smoothstep(0, 1, uv().x), tailFade);
  material.positionNode = createInstancedPositionNode();
  material.colorNode = instanceTint().mul(glow.mul(0.55).add(core.mul(1.3)).mul(tail));
  return material;
}

function createDecalMaterial(puffTexture: Texture): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  material.name = "decal";
  const extra = instanceExtra();
  const centered = uv().sub(0.5).mul(2);
  const radius = length(centered);
  const noise = texture(puffTexture, uv().mul(0.5)).a;
  const blotch = saturate(smoothstep(1, 0.15, radius).mul(0.75).add(noise.mul(1.6)).sub(0.3))
    .mul(float(1).sub(smoothstep(0.82, 1, radius)));
  const box = smoothstep(1, 0.55, abs(centered.x)).mul(smoothstep(1, 0.5, abs(centered.y)));
  const disc = pow(saturate(float(1).sub(radius)), 1.5);
  // extra: x = alpha, y = soft box (track print), z = soft disc (blob shadow), else scorch.
  const mask = mix(mix(blotch, box, extra.y), disc, extra.z);
  material.positionNode = createInstancedPositionNode();
  material.colorNode = vec4(instanceTint(), extra.x.mul(mask));
  return material;
}

function createHealthBarMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
  material.name = "health-bar";
  material.positionNode = createInstancedPositionNode();
  material.colorNode = instanceTint();
  return material;
}

function createRangeMaterial(uniforms: MaterialUniforms): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  material.name = "range";
  const centered = uv().sub(0.5).mul(2);
  const radius = length(centered);
  const edge = smoothstep(0.95, 0.982, radius).mul(float(1).sub(smoothstep(0.988, 1, radius)));
  const angle = atan(centered.y, centered.x);
  const dash = smoothstep(0.3, 0.5, fract(angle.div(TWO_PI).mul(64).add(uniforms.time.mul(0.35))));
  const inside = float(1).sub(step(1, radius));
  const fill = inside.mul(pow(radius, 4).mul(0.12).add(0.022));
  material.positionNode = createInstancedPositionNode();
  material.colorNode = instanceTint().mul(edge.mul(mix(float(0.4), float(1), dash)).add(fill));
  return material;
}

/** Flat additive disc/ring lying on the ground (perspective-correct shockwaves and pulses). */
function createGroundGlowMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  material.name = "ground-glow";
  const extra = instanceExtra();
  const distance = length(uv().sub(0.5)).mul(2);
  const disc = pow(saturate(float(1).sub(distance)), 2);
  const ring = smoothstep(0.62, 0.84, distance).mul(float(1).sub(smoothstep(0.87, 1, distance)));
  material.positionNode = createInstancedPositionNode();
  material.colorNode = vec4(instanceTint(), extra.x.mul(mix(disc, ring, extra.y)));
  return material;
}

function createGlowSpriteMaterial(attributes: SpriteBatchAttributes): SpriteNodeMaterial {
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  material.name = "glow-sprite";
  const transform = instancedDynamicBufferAttribute<"vec4">(attributes.transform, "vec4");
  const shape = instancedDynamicBufferAttribute<"vec4">(attributes.shape, "vec4");
  const color = instancedDynamicBufferAttribute<"vec4">(attributes.color, "vec4");
  material.positionNode = transform.xyz;
  material.rotationNode = transform.w;
  material.scaleNode = shape.xy;
  const distance = length(uv().sub(0.5)).mul(2);
  const soft = pow(saturate(float(1).sub(distance)), 2);
  const core = smoothstep(0.3, 0, distance);
  const ring = smoothstep(0.66, 0.82, distance).mul(float(1).sub(smoothstep(0.86, 1, distance)));
  const intensity = mix(soft.mul(0.7).add(core.mul(0.9)), ring, shape.z);
  material.colorNode = vec4(color.rgb, color.a.mul(intensity));
  return material;
}

function createSmokeSpriteMaterial(attributes: SpriteBatchAttributes, puffTexture: Texture): SpriteNodeMaterial {
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  material.name = "smoke-sprite";
  const transform = instancedDynamicBufferAttribute<"vec4">(attributes.transform, "vec4");
  const shape = instancedDynamicBufferAttribute<"vec4">(attributes.shape, "vec4");
  const color = instancedDynamicBufferAttribute<"vec4">(attributes.color, "vec4");
  material.positionNode = transform.xyz;
  material.rotationNode = transform.w;
  material.scaleNode = shape.xy;
  const cellOffset = vec2(mod(shape.z, float(2)), floor(shape.z.div(2)));
  const puff = texture(puffTexture, uv().add(cellOffset).mul(0.5)).a;
  material.colorNode = vec4(color.rgb, color.a.mul(puff));
  return material;
}

/**
 * Benchmark aid: a nonzero salt adds an inert constant to every shader so the GPU driver's
 * shader cache misses, making cold (first-visit) compile cost measurable on demand.
 */
function applyShaderSalt<T extends NodeMaterial>(material: T, salt: number): T {
  if (salt === 0) {
    return material;
  }
  const saltNode = float(salt * 1e-12);
  if (material.colorNode) {
    material.colorNode = (material.colorNode as Node<"vec4">).add(saltNode);
  }
  if (material.positionNode) {
    material.positionNode = (material.positionNode as Node<"vec3">).add(saltNode);
  }
  return material;
}

export function createMaterialSet(uniforms: MaterialUniforms, puffTexture: Texture, shaderSalt: number): MaterialSet {
  const salted = <T extends NodeMaterial>(material: T): T => applyShaderSalt(material, shaderSalt);
  return {
    neon: salted(createNeonMaterial()),
    ground: salted(createGroundMaterial(uniforms)),
    road: salted(createRoadMaterial(uniforms)),
    ribbon: salted(createRibbonMaterial()),
    decal: salted(createDecalMaterial(puffTexture)),
    healthBar: salted(createHealthBarMaterial()),
    range: salted(createRangeMaterial(uniforms)),
    groundGlow: salted(createGroundGlowMaterial()),
    createGlowSprite: (attributes) => salted(createGlowSpriteMaterial(attributes)),
    createSmokeSprite: (attributes) => salted(createSmokeSpriteMaterial(attributes, puffTexture)),
  };
}
