/**
 * Every shader the board uses. Scene shaders share the `Frame` uniform block (camera,
 * lights, field) and the instance layout written by InstancedBatch. Lighting mirrors the
 * previous three.js Lambert setup: albedo / pi times hemisphere + directional + point
 * irradiance, plus emissive.
 */

/** Float offsets inside the Frame uniform buffer (keep in sync with `FRAME`). */
export const FrameLayout = {
  viewProjection: 0,
  view: 16,
  projection: 32,
  camera: 48,
  field: 52,
  hemiSky: 56,
  hemiGround: 60,
  keyDirection: 64,
  keyColor: 68,
  rimDirection: 72,
  rimColor: 76,
  pointPosition: 80,
  pointColor: 96,
  floats: 112,
} as const;

export const MAX_POINT_LIGHTS = 4;

const FRAME = /* wgsl */ `
struct Frame {
  viewProjection: mat4x4f,
  view: mat4x4f,
  projection: mat4x4f,
  camera: vec4f,
  field: vec4f,
  hemiSky: vec4f,
  hemiGround: vec4f,
  keyDirection: vec4f,
  keyColor: vec4f,
  rimDirection: vec4f,
  rimColor: vec4f,
  pointPosition: array<vec4f, 4>,
  pointColor: array<vec4f, 4>,
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var puffSampler: sampler;
@group(0) @binding(2) var puffTexture: texture_2d<f32>;

const INV_PI = 0.3183098861837907;
const TWO_PI = 6.283185307179586;

// Hermite smoothstep that is well defined for reversed edges.
fn sstep(e0: f32, e1: f32, x: f32) -> f32 {
  let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

fn lambert(albedo: vec3f, n: vec3f, worldPosition: vec3f) -> vec3f {
  let hemiWeight = n.y * 0.5 + 0.5;
  var irradiance = mix(frame.hemiGround.rgb, frame.hemiSky.rgb, hemiWeight);
  irradiance += saturate(dot(n, frame.keyDirection.xyz)) * frame.keyColor.rgb;
  irradiance += saturate(dot(n, frame.rimDirection.xyz)) * frame.rimColor.rgb;
  for (var index = 0u; index < 4u; index++) {
    let toLight = frame.pointPosition[index].xyz - worldPosition;
    let distance = max(length(toLight), 1e-4);
    let cutoff = frame.pointPosition[index].w;
    let decay = frame.pointColor[index].w;
    let windowed = saturate(1.0 - pow(distance / cutoff, 4.0));
    let falloff = (1.0 / max(pow(distance, decay), 0.01)) * windowed * windowed;
    irradiance += saturate(dot(n, toLight / distance)) * frame.pointColor[index].rgb * falloff;
  }
  return albedo * irradiance * INV_PI;
}
`;

const INSTANCE = /* wgsl */ `
struct InstanceIn {
  @location(3) m0: vec4f,
  @location(4) m1: vec4f,
  @location(5) m2: vec4f,
  @location(6) m3: vec4f,
  @location(7) tint: vec4f,
  @location(8) extra: vec4f,
};

fn instanceMatrix(instance: InstanceIn) -> mat4x4f {
  return mat4x4f(instance.m0, instance.m1, instance.m2, instance.m3);
}

// Instance matrices are rotation x scale, so dividing each column by its squared length is
// the exact inverse transpose for normals.
fn instanceNormal(instance: InstanceIn, n: vec3f) -> vec3f {
  let ax = instance.m0.xyz;
  let ay = instance.m1.xyz;
  let az = instance.m2.xyz;
  return normalize(ax * (n.x / (dot(ax, ax) + 1e-8)) + ay * (n.y / (dot(ay, ay) + 1e-8)) + az * (n.z / (dot(az, az) + 1e-8)));
}
`;

export const NEON_SHADER = FRAME + INSTANCE + /* wgsl */ `
struct VertexIn {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) glow: f32,
};

struct Varying {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  @location(2) tint: vec3f,
  @location(3) glow: f32,
};

const KEY_LIGHT = vec3f(-0.33, 0.85, -0.44);

@vertex fn vertexMain(vertex: VertexIn, instance: InstanceIn) -> Varying {
  let world = instanceMatrix(instance) * vec4f(vertex.position, 1.0);
  var out: Varying;
  out.clip = frame.viewProjection * world;
  out.world = world.xyz;
  out.normal = instanceNormal(instance, vertex.normal);
  out.tint = instance.tint.rgb;
  out.glow = vertex.glow;
  return out;
}

@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let n = normalize(in.normal);
  let viewDirection = normalize(frame.camera.xyz - in.world);
  let rim = pow(1.0 - saturate(dot(n, viewDirection)), 2.6);
  // Cheap Blinn highlight from the key light keeps dark bodies glossy.
  let highlight = pow(saturate(dot(n, normalize(normalize(KEY_LIGHT) + viewDirection))), 36.0) * (1.0 - in.glow);
  let albedo = in.tint * mix(0.032, 1.0, in.glow);
  let emissive = in.tint * (in.glow * 1.25 + rim * 0.6) + vec3f(highlight * 0.3);
  return vec4f(lambert(albedo, n, in.world) + emissive, 1.0);
}
`;

export const GROUND_SHADER = FRAME + /* wgsl */ `
struct Varying {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
};

const GRID_SPACING = 35.0;
const GROUND_HALF_SIZE = 3000.0;

@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> Varying {
  // Counter-clockwise seen from above (+Y), so back-face culling keeps the top side.
  var corners = array<vec2f, 6>(vec2f(-1.0, 1.0), vec2f(1.0, 1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(-1.0, -1.0));
  let point = corners[index] * GROUND_HALF_SIZE + frame.field.xy * 0.5;
  var out: Varying;
  out.world = vec3f(point.x, 0.0, point.y);
  out.clip = frame.viewProjection * vec4f(out.world, 1.0);
  return out;
}

fn gridLine(coordinate: vec2f) -> f32 {
  let distance = abs(fract(coordinate - 0.5) - 0.5) / fwidth(coordinate);
  return 1.0 - min(min(distance.x, distance.y), 1.0);
}

@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let field = in.world.xz;
  let cell = field / GRID_SPACING;
  let minorLine = gridLine(cell);
  let majorLine = gridLine(field / (GRID_SPACING * 5.0));
  let panelNoise = fract(sin(dot(floor(cell), vec2f(12.9898, 78.233))) * 43758.5453);
  let fieldSize = frame.field.xy;
  let focusDistance = length((field - fieldSize * 0.5) / (fieldSize * 0.64));
  let focus = 1.0 - sstep(0.62, 1.55, focusDistance);
  let panelShade = panelNoise * 0.28 + 0.86;
  let albedo = vec3f(0.0045, 0.0095, 0.008) * panelShade * (focus * 0.6 + 0.4);
  let emissive = vec3f(0.004, 0.02, 0.016) * (minorLine * 0.75 + majorLine * 0.9) * (focus * 0.8 + 0.2);
  return vec4f(lambert(albedo, vec3f(0.0, 1.0, 0.0), in.world) + emissive, 1.0);
}
`;

export const ROAD_SHADER = FRAME + /* wgsl */ `
struct VertexIn {
  @location(0) position: vec3f,
  @location(1) uv: vec2f,
};

struct Varying {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) uv: vec2f,
};

const CHEVRON_SPACING = 30.0;
const CHEVRON_SPEED = 22.0;

@vertex fn vertexMain(vertex: VertexIn) -> Varying {
  var out: Varying;
  out.world = vertex.position;
  out.uv = vertex.uv;
  out.clip = frame.viewProjection * vec4f(vertex.position, 1.0);
  return out;
}

@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let along = in.uv.x;
  let across = abs(in.uv.y);
  let edge = sstep(0.8, 0.9, across) * (1.0 - sstep(0.95, 1.0, across));
  let channelShade = mix(1.0, 0.5, sstep(0.25, 0.92, across));
  let phase = fract((along + across * frame.field.z * 0.85) / CHEVRON_SPACING - frame.camera.w * (CHEVRON_SPEED / CHEVRON_SPACING));
  let chevron = sstep(0.0, 0.05, phase) * (1.0 - sstep(0.09, 0.2, phase)) * (1.0 - sstep(0.42, 0.66, across));
  let albedo = vec3f(0.0035, 0.024, 0.02) * channelShade;
  let emissive = vec3f(0.018, 0.15, 0.115) * edge + vec3f(0.03, 0.2, 0.15) * (chevron * 0.22);
  return vec4f(lambert(albedo, vec3f(0.0, 1.0, 0.0), in.world) + emissive, 1.0);
}
`;

const FLAT_VERTEX = FRAME + INSTANCE + /* wgsl */ `
struct VertexIn {
  @location(0) position: vec3f,
  @location(1) uv: vec2f,
};

struct Varying {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) tint: vec3f,
  @location(2) extra: vec4f,
};

@vertex fn vertexMain(vertex: VertexIn, instance: InstanceIn) -> Varying {
  var out: Varying;
  out.clip = frame.viewProjection * (instanceMatrix(instance) * vec4f(vertex.position, 1.0));
  out.uv = vertex.uv;
  out.tint = instance.tint.rgb;
  out.extra = instance.extra;
  return out;
}
`;

/** Additive energy ribbon: soft glow with a hot core; extra.x fades the tail. */
export const RIBBON_SHADER = FLAT_VERTEX + /* wgsl */ `
@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let across = abs(in.uv.y - 0.5) * 2.0;
  let glow = pow(saturate(1.0 - across), 2.2);
  let core = sstep(0.38, 0.0, across);
  let tail = mix(1.0, sstep(0.0, 1.0, in.uv.x), in.extra.x);
  return vec4f(in.tint * ((glow * 0.55 + core * 1.3) * tail), 1.0);
}
`;

/** Ground decals: extra = (alpha, soft box, soft disc, -); otherwise a noisy scorch blotch. */
export const DECAL_SHADER = FLAT_VERTEX + /* wgsl */ `
@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let centered = (in.uv - 0.5) * 2.0;
  let radius = length(centered);
  let noise = textureSample(puffTexture, puffSampler, in.uv * 0.5).r;
  let blotch = saturate(sstep(1.0, 0.15, radius) * 0.75 + noise * 1.6 - 0.3) * (1.0 - sstep(0.82, 1.0, radius));
  let box = sstep(1.0, 0.55, abs(centered.x)) * sstep(1.0, 0.5, abs(centered.y));
  let disc = pow(saturate(1.0 - radius), 1.5);
  let mask = mix(mix(blotch, box, in.extra.y), disc, in.extra.z);
  return vec4f(in.tint, in.extra.x * mask);
}
`;

export const HEALTH_BAR_SHADER = FLAT_VERTEX + /* wgsl */ `
@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  return vec4f(in.tint, 1.0);
}
`;

/** Tower range: dashed rotating rim over a faint radial fill. */
export const RANGE_SHADER = FLAT_VERTEX + /* wgsl */ `
@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let centered = (in.uv - 0.5) * 2.0;
  let radius = length(centered);
  let edge = sstep(0.95, 0.982, radius) * (1.0 - sstep(0.988, 1.0, radius));
  let angle = atan2(centered.y, centered.x);
  let dash = sstep(0.3, 0.5, fract(angle / TWO_PI * 64.0 + frame.camera.w * 0.35));
  let inside = 1.0 - step(1.0, radius);
  let fill = inside * (pow(radius, 4.0) * 0.12 + 0.022);
  return vec4f(in.tint * (edge * mix(0.4, 1.0, dash) + fill), 1.0);
}
`;

/** Flat glow on the ground: extra = (alpha, shape: 0 disc / 1 ring). */
export const GROUND_GLOW_SHADER = FLAT_VERTEX + /* wgsl */ `
@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let distance = length(in.uv - 0.5) * 2.0;
  let disc = pow(saturate(1.0 - distance), 2.0);
  let ring = sstep(0.62, 0.84, distance) * (1.0 - sstep(0.87, 1.0, distance));
  return vec4f(in.tint, in.extra.x * mix(disc, ring, in.extra.y));
}
`;

const SPRITE_VERTEX = FRAME + /* wgsl */ `
struct SpriteIn {
  @location(0) transform: vec4f,
  @location(1) shape: vec4f,
  @location(2) color: vec4f,
};

struct Varying {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) shape: f32,
};

// Camera-facing quad: the corner offset is applied in view space, rotated by transform.w.
@vertex fn vertexMain(@builtin(vertex_index) index: u32, sprite: SpriteIn) -> Varying {
  var corners = array<vec2f, 6>(vec2f(-0.5, -0.5), vec2f(0.5, -0.5), vec2f(0.5, 0.5), vec2f(-0.5, -0.5), vec2f(0.5, 0.5), vec2f(-0.5, 0.5));
  let corner = corners[index];
  let center = frame.view * vec4f(sprite.transform.xyz, 1.0);
  let scaled = corner * sprite.shape.xy;
  let c = cos(sprite.transform.w);
  let s = sin(sprite.transform.w);
  let rotated = vec2f(scaled.x * c - scaled.y * s, scaled.x * s + scaled.y * c);
  var out: Varying;
  out.clip = frame.projection * vec4f(center.xy + rotated, center.zw);
  out.uv = corner + 0.5;
  out.color = sprite.color;
  out.shape = sprite.shape.z;
  return out;
}
`;

/** Additive glow: soft dot with a hot core, or a ring when shape = 1. */
export const GLOW_SPRITE_SHADER = SPRITE_VERTEX + /* wgsl */ `
@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let distance = length(in.uv - 0.5) * 2.0;
  let soft = pow(saturate(1.0 - distance), 2.0);
  let core = sstep(0.3, 0.0, distance);
  let ring = sstep(0.66, 0.82, distance) * (1.0 - sstep(0.86, 1.0, distance));
  let intensity = mix(soft * 0.7 + core * 0.9, ring, in.shape);
  return vec4f(in.color.rgb, in.color.a * intensity);
}
`;

/** Smoke puff from the 2x2 procedural atlas; shape selects the cell. */
export const SMOKE_SPRITE_SHADER = SPRITE_VERTEX + /* wgsl */ `
@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let cell = vec2f(in.shape % 2.0, floor(in.shape / 2.0));
  let puff = textureSample(puffTexture, puffSampler, (in.uv + cell) * 0.5).r;
  return vec4f(in.color.rgb, in.color.a * puff);
}
`;

// ---------------------------------------------------------------- post-processing

const FULLSCREEN_VERTEX = /* wgsl */ `
struct Varying {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> Varying {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let position = positions[index];
  var out: Varying;
  out.clip = vec4f(position, 0.0, 1.0);
  out.uv = vec2f((position.x + 1.0) * 0.5, (1.0 - position.y) * 0.5);
  return out;
}
`;

/** 4-tap box downsample (16-texel footprint) with a soft brightness threshold (0 = none). */
export const DOWNSAMPLE_SHADER = FULLSCREEN_VERTEX + /* wgsl */ `
struct Params {
  texel: vec2f,
  threshold: f32,
  unused: f32,
};

@group(0) @binding(0) var linearSampler: sampler;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: Params;

@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let t = params.texel;
  let average = (
    textureSample(source, linearSampler, in.uv + t * vec2f(-1.0, -1.0)).rgb
    + textureSample(source, linearSampler, in.uv + t * vec2f(1.0, -1.0)).rgb
    + textureSample(source, linearSampler, in.uv + t * vec2f(-1.0, 1.0)).rgb
    + textureSample(source, linearSampler, in.uv + t * vec2f(1.0, 1.0)).rgb
  ) * 0.25;
  let brightness = max(max(average.r, average.g), average.b);
  return vec4f(average * (max(brightness - params.threshold, 0.0) / max(brightness, 1e-4)), 1.0);
}
`;

/** One direction of a linear-sampled 9-tap Gaussian. */
export const BLUR_SHADER = FULLSCREEN_VERTEX + /* wgsl */ `
struct Params {
  texel: vec2f,
  direction: vec2f,
};

@group(0) @binding(0) var linearSampler: sampler;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: Params;

@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let step = params.texel * params.direction;
  var color = textureSample(source, linearSampler, in.uv).rgb * 0.2270270270;
  let near = step * 1.3846153846;
  let far = step * 3.2307692308;
  color += (textureSample(source, linearSampler, in.uv + near).rgb + textureSample(source, linearSampler, in.uv - near).rgb) * 0.3162162162;
  color += (textureSample(source, linearSampler, in.uv + far).rgb + textureSample(source, linearSampler, in.uv - far).rgb) * 0.0702702703;
  return vec4f(color, 1.0);
}
`;

/** Scene + two bloom levels, vignette, ACES filmic tone mapping, and sRGB encoding. */
export const COMPOSITE_SHADER = FULLSCREEN_VERTEX + /* wgsl */ `
@group(0) @binding(0) var linearSampler: sampler;
@group(0) @binding(1) var sceneColor: texture_2d<f32>;
@group(0) @binding(2) var fineBloom: texture_2d<f32>;
@group(0) @binding(3) var wideBloom: texture_2d<f32>;

const BLOOM_STRENGTH = 0.8;
const FINE_BLOOM_WEIGHT = 0.9;
const WIDE_BLOOM_WEIGHT = 1.2;
const VIGNETTE_STRENGTH = 0.4;

fn sstep(e0: f32, e1: f32, x: f32) -> f32 {
  let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

fn rrtAndOdtFit(color: vec3f) -> vec3f {
  let a = color * (color + 0.0245786) - 0.000090537;
  let b = color * (color * 0.983729 + 0.4329510) + 0.238081;
  return a / b;
}

fn acesFilmic(input: vec3f) -> vec3f {
  let inputMatrix = mat3x3f(0.59719, 0.35458, 0.04823, 0.07600, 0.90834, 0.01566, 0.02840, 0.13383, 0.83777);
  let outputMatrix = mat3x3f(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602);
  // Matrices are written row by row (as in the reference ACES fit), so vectors multiply on the left.
  var color = input / 0.6;
  color = color * inputMatrix;
  color = rrtAndOdtFit(color);
  color = color * outputMatrix;
  return saturate(color);
}

fn srgbEncode(color: vec3f) -> vec3f {
  let curve = pow(color, vec3f(0.41666)) * 1.055 - 0.055;
  return select(curve, color * 12.92, color <= vec3f(0.0031308));
}

@fragment fn fragmentMain(in: Varying) -> @location(0) vec4f {
  let screen = in.clip.xy / vec2f(textureDimensions(sceneColor));
  let bloom = textureSample(fineBloom, linearSampler, in.uv).rgb * FINE_BLOOM_WEIGHT + textureSample(wideBloom, linearSampler, in.uv).rgb * WIDE_BLOOM_WEIGHT;
  let vignette = 1.0 - sstep(0.38, 0.98, length((screen - 0.5) * vec2f(1.12, 1.0))) * VIGNETTE_STRENGTH;
  let color = (textureSample(sceneColor, linearSampler, in.uv).rgb + bloom * BLOOM_STRENGTH) * vignette;
  return vec4f(srgbEncode(acesFilmic(color)), 1.0);
}
`;
