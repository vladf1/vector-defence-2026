export const DRONE_ACCENT_COLORS = ["#9dffd7", "#d8ff4f", "#ffe27a", "#ffad4f", "#ff8edb", "#b58cff", "#7fd7ff"] as const;

const DRONE_PROPELLERS = [
  { x: -6.9, y: -6.9 },
  { x: 6.9, y: -6.9 },
  { x: -6.9, y: 6.9 },
  { x: 6.9, y: 6.9 },
] as const;

interface DroneBodyStyle {
  accentFillStyle: string;
  frameLineWidth: number;
  frameStrokeStyle: string;
  level: number;
  motorFillStyle: string;
  motorRadius: number;
  propellerFillStyle: string;
  propellerRadius: number;
}

export function drawDroneBody(context: CanvasRenderingContext2D, style: DroneBodyStyle): void {
  context.strokeStyle = style.frameStrokeStyle;
  context.lineWidth = style.frameLineWidth;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-6.9, -6.9);
  context.lineTo(6.9, 6.9);
  context.moveTo(6.9, -6.9);
  context.lineTo(-6.9, 6.9);
  context.stroke();

  for (const propeller of DRONE_PROPELLERS) {
    context.fillStyle = style.propellerFillStyle;
    context.beginPath();
    context.arc(propeller.x, propeller.y, style.propellerRadius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = style.motorFillStyle;
    context.beginPath();
    context.arc(propeller.x, propeller.y, style.motorRadius, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#06100f";
  context.strokeStyle = "#effff7";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(-3.9, -3.9, 7.8, 7.8, 1.5);
  context.fill();
  context.stroke();

  context.fillStyle = style.accentFillStyle;
  const accentWidth = 3.6 + (style.level * 0.16);
  context.fillRect(-accentWidth / 2, -0.9, accentWidth, 1.8);

  if (style.level >= 3) {
    context.strokeStyle = style.accentFillStyle;
    context.lineWidth = 0.75;
    context.beginPath();
    context.moveTo(-2.8, -5.2);
    context.lineTo(2.8, -5.2);
    context.moveTo(-2.8, 5.2);
    context.lineTo(2.8, 5.2);
    context.stroke();
  }
}
