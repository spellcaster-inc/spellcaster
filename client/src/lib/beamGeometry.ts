export interface BeamPoint {
  x: number;
  y: number;
}

export function calculateBeamCollisionPoint(
  leftWandTip: BeamPoint,
  rightWandTip: BeamPoint,
  beamOffset: number
): BeamPoint {
  const clampedOffset = Math.max(-100, Math.min(100, beamOffset));
  const progressFromLeft = (clampedOffset + 100) / 200;

  return {
    x: leftWandTip.x + (rightWandTip.x - leftWandTip.x) * progressFromLeft,
    y: leftWandTip.y + (rightWandTip.y - leftWandTip.y) * progressFromLeft,
  };
}
