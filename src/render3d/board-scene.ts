import type { RouteMotionPath } from "../route-path";
import type { ScenePipelines } from "./gpu-pipelines";
import { hash01, type FrameContext } from "./frame-math";
import { linearColor } from "./palette";
import type { RenderBatches } from "./render-batches";
import { BufferUsage } from "./gpu-flags";

const ROAD_BORDER = 1.5;
const ROAD_BASE_Y = 0.22;
// Later road samples sit microscopically higher so self-crossing routes never z-fight.
const ROAD_LAYER_STEP = 0.00035;
const ROAD_LEAD_IN = 90;
const EXIT_PORTAL_RADIUS = 19;
const PORTAL_COLOR = linearColor("#b0ffe1");
const PORTAL_ALERT = linearColor("#ff6f62");
const GATE_COLOR = linearColor("#ff8f6a");
const MOTE_COLOR = linearColor("#7dffd4");
const MOTE_COUNT = 70;

// Longest authored route samples to ~1k entries; headroom keeps one buffer for all levels.
const ROAD_CAPACITY_ENTRIES = 4096;

const ROAD_VERTEX_FLOATS = 5;
const GROUND_VERTICES = 6;

/**
 * One persistent road ribbon (uv.x = distance, uv.y = -1..1 across) rewritten in place per
 * level: interleaved `position(3) uv(2)` pairs joined by a fixed index buffer.
 */
class RoadRibbon {
  private readonly vertices: Float32Array;
  private readonly vertexBuffer: GPUBuffer;
  private readonly indexBuffer: GPUBuffer;
  private indexCount = 0;

  constructor(private readonly device: GPUDevice) {
    const vertexCapacity = (ROAD_CAPACITY_ENTRIES + 1) * 2;
    this.vertices = new Float32Array(vertexCapacity * ROAD_VERTEX_FLOATS);
    this.vertexBuffer = device.createBuffer({ label: "road", size: this.vertices.byteLength, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const indices = new Uint32Array(ROAD_CAPACITY_ENTRIES * 6);
    for (let slot = 0; slot < ROAD_CAPACITY_ENTRIES; slot += 1) {
      const a = slot * 2;
      indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], slot * 6);
    }
    this.indexBuffer = device.createBuffer({ label: "road-indices", size: indices.byteLength, usage: BufferUsage.INDEX | BufferUsage.COPY_DST });
    device.queue.writeBuffer(this.indexBuffer, 0, indices);
  }

  write(route: RouteMotionPath, width: number): void {
    const entries = route.entries;
    const count = Math.min(entries.length, ROAD_CAPACITY_ENTRIES);
    const halfWidth = width / 2;
    const v = this.vertices;
    const tangentAt = (index: number): { x: number; y: number } => {
      const previous = entries[Math.max(0, index - 1)];
      const next = entries[Math.min(count - 1, index + 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: dx / length, y: dy / length };
    };
    const writePair = (slot: number, x: number, y: number, tangentX: number, tangentY: number, distance: number): void => {
      const height = ROAD_BASE_Y + (slot * ROAD_LAYER_STEP);
      const offset = slot * ROAD_VERTEX_FLOATS * 2;
      v[offset] = x - (tangentY * halfWidth);
      v[offset + 1] = height;
      v[offset + 2] = y + (tangentX * halfWidth);
      v[offset + 3] = distance;
      v[offset + 4] = 1;
      v[offset + 5] = x + (tangentY * halfWidth);
      v[offset + 6] = height;
      v[offset + 7] = y - (tangentX * halfWidth);
      v[offset + 8] = distance;
      v[offset + 9] = -1;
    };

    const startTangent = tangentAt(0);
    writePair(0, entries[0].x - (startTangent.x * ROAD_LEAD_IN), entries[0].y - (startTangent.y * ROAD_LEAD_IN), startTangent.x, startTangent.y, -ROAD_LEAD_IN);
    for (let index = 0; index < count; index += 1) {
      const tangent = tangentAt(index);
      writePair(index + 1, entries[index].x, entries[index].y, tangent.x, tangent.y, entries[index].totalDistance);
    }
    this.device.queue.writeBuffer(this.vertexBuffer, 0, v.buffer, 0, (count + 1) * 2 * ROAD_VERTEX_FLOATS * 4);
    this.indexCount = Math.max(0, count) * 6;
  }

  clear(): void {
    this.indexCount = 0;
  }

  draw(pass: GPURenderPassEncoder): void {
    if (this.indexCount === 0) {
      return;
    }
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, "uint32");
    pass.drawIndexed(this.indexCount);
  }

  dispose(): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
  }
}

/** Static battlefield: ground, the route's road, the exit portal, and the spawn gate. */
export class BoardScene {
  private readonly roadRibbon: RoadRibbon;
  private route: RouteMotionPath | undefined;
  private exitAlert = 0;
  private lastEscapesLeft = -1;

  constructor(
    private readonly fieldWidth: number,
    private readonly fieldHeight: number,
    private readonly roadWidth: number,
    device: GPUDevice,
  ) {
    this.roadRibbon = new RoadRibbon(device);
  }

  get routePath(): RouteMotionPath | undefined {
    return this.route;
  }

  setRoute(route: RouteMotionPath | undefined): void {
    if (route === this.route) {
      return;
    }
    this.route = route;
    this.lastEscapesLeft = -1;
    if (route !== undefined && route.entries.length >= 2) {
      this.roadRibbon.write(route, this.roadWidth + (ROAD_BORDER * 2));
    } else {
      this.roadRibbon.clear();
    }
  }

  notifyEscapes(escapesLeft: number): void {
    if (this.lastEscapesLeft >= 0 && escapesLeft < this.lastEscapesLeft) {
      this.exitAlert = 1;
    }
    this.lastEscapesLeft = escapesLeft;
  }

  /** Stateless drifting energy motes: positions are pure functions of time and index. */
  private writeMotes(batches: RenderBatches, frame: FrameContext): void {
    const { fieldWidth, fieldHeight } = this;
    for (let index = 0; index < MOTE_COUNT; index += 1) {
      const seedX = hash01(index * 3.1);
      const seedY = hash01((index * 7.7) + 1);
      const speed = 3 + (hash01(index * 5.3) * 6);
      const x = (((seedX * fieldWidth) + (frame.time * speed)) % (fieldWidth + 80)) - 40;
      const y = (seedY * fieldHeight) + (Math.sin((frame.time * 0.4) + (index * 1.7)) * 14);
      const height = 12 + (hash01(index * 2.3) * 40) + (Math.sin((frame.time * 0.7) + index) * 5);
      const twinkle = 0.35 + (Math.sin((frame.time * (1.3 + seedX)) + (index * 2.1)) * 0.35);
      const size = 1.6 + (hash01(index * 9.1) * 2.2);
      batches.glow.push(x, height, y, 0, size, size, 0, MOTE_COLOR.r, MOTE_COLOR.g, MOTE_COLOR.b, Math.max(0, twinkle) * 0.55);
    }
  }

  write(batches: RenderBatches, frame: FrameContext): void {
    this.writeMotes(batches, frame);
    const route = this.route;
    if (!route || route.entries.length < 2) {
      return;
    }
    this.exitAlert = Math.max(0, this.exitAlert - (frame.deltaSeconds * 1.6));
    const exit = route.entries[route.entries.length - 1];
    const pulse = 0.85 + (Math.sin(frame.time * 3.1) * 0.15);
    const alert = this.exitAlert;
    const red = (PORTAL_COLOR.r + ((PORTAL_ALERT.r - PORTAL_COLOR.r) * alert)) * pulse * (1 + alert);
    const green = (PORTAL_COLOR.g + ((PORTAL_ALERT.g - PORTAL_COLOR.g) * alert)) * pulse * (1 + alert);
    const blue = (PORTAL_COLOR.b + ((PORTAL_ALERT.b - PORTAL_COLOR.b) * alert)) * pulse * (1 + alert);
    batches.portal.pushYaw(exit.x, 0.3, exit.y, frame.time * 0.35, EXIT_PORTAL_RADIUS, EXIT_PORTAL_RADIUS, EXIT_PORTAL_RADIUS, red, green, blue);
    batches.pushGroundGlow(exit.x, 0.9, exit.y, EXIT_PORTAL_RADIUS * 1.7, 0, red * 0.2, green * 0.2, blue * 0.2, 1);
    for (let index = 0; index < 3; index += 1) {
      const phase = ((frame.time * 0.45) + (index / 3)) % 1;
      const radius = EXIT_PORTAL_RADIUS * 1.15 * (1 - phase);
      batches.glow.push(exit.x, 1 + (phase * 14), exit.y, 0, radius * 1.6, radius * 1.6, 1, red * 0.7, green * 0.7, blue * 0.7, phase * (1 - phase) * 2.2);
    }

    const start = route.entries[0];
    const next = route.entries[Math.min(route.entries.length - 1, 3)];
    const angle = Math.atan2(next.y - start.y, next.x - start.x);
    const gateGlow = 0.8 + (Math.sin(frame.time * 4.2) * 0.2);
    batches.spawnGate.pushYaw(start.x, 0, start.y, -angle, 1, 1, 1, GATE_COLOR.r * gateGlow, GATE_COLOR.g * gateGlow, GATE_COLOR.b * gateGlow);
  }

  get drawCalls(): number {
    return this.route && this.route.entries.length >= 2 ? 2 : 1;
  }

  /** The ground is a shader-generated quad around the field (no vertex buffers). */
  draw(pass: GPURenderPassEncoder, pipelines: ScenePipelines): void {
    pass.setPipeline(pipelines.ground);
    pass.draw(GROUND_VERTICES);
    pass.setPipeline(pipelines.road);
    this.roadRibbon.draw(pass);
  }

  dispose(): void {
    this.roadRibbon.dispose();
  }
}
