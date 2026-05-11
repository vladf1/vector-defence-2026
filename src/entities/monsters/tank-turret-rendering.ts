export function drawTankTurret(context: CanvasRenderingContext2D, tankRadius: number, turretRadiusScale: number, barrelEndScale: number): void {
  const turretCenterX = tankRadius * 0.08;
  const turretRadius = tankRadius * turretRadiusScale;
  context.beginPath();
  context.arc(turretCenterX, 0, turretRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(turretCenterX + (turretRadius * 0.92), 0);
  context.lineTo(tankRadius * barrelEndScale, 0);
  context.stroke();
}
