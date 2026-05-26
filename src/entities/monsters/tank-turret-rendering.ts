export function getTankTurretCenterOffsetX(tankRadius: number): number {
  return tankRadius * 0.08;
}

export function drawTankTurret(
  context: CanvasRenderingContext2D,
  tankRadius: number,
  turretRadiusScale: number,
  barrelEndScale: number,
  barrelRotation: number,
): void {
  const turretRadius = tankRadius * turretRadiusScale;
  const barrelEndX = (tankRadius * barrelEndScale) - getTankTurretCenterOffsetX(tankRadius);
  context.beginPath();
  context.arc(0, 0, turretRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.save();
  context.rotate(barrelRotation);
  context.beginPath();
  context.moveTo(turretRadius * 0.92, 0);
  context.lineTo(barrelEndX, 0);
  context.stroke();
  context.restore();
}
