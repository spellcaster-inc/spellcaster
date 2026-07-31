import { describe, expect, it } from 'vitest';
import { calculateBeamCollisionPoint } from '../src/lib/beamGeometry';

const leftWandTip = { x: 20, y: 40 };
const rightWandTip = { x: 220, y: 80 };

describe('calculateBeamCollisionPoint', () => {
  it('places a neutral beam halfway between the wand tips', () => {
    expect(calculateBeamCollisionPoint(leftWandTip, rightWandTip, 0)).toEqual({
      x: 120,
      y: 60,
    });
  });

  it('places the collision at the correct wand for each overwhelm threshold', () => {
    expect(calculateBeamCollisionPoint(leftWandTip, rightWandTip, -100)).toEqual(leftWandTip);
    expect(calculateBeamCollisionPoint(leftWandTip, rightWandTip, 100)).toEqual(rightWandTip);
  });

  it('interpolates positive and negative offsets along the same line', () => {
    expect(calculateBeamCollisionPoint(leftWandTip, rightWandTip, 50)).toEqual({
      x: 170,
      y: 70,
    });
    expect(calculateBeamCollisionPoint(leftWandTip, rightWandTip, -50)).toEqual({
      x: 70,
      y: 50,
    });
  });

  it('clamps invalid offsets so the collision never leaves the wand tips', () => {
    expect(calculateBeamCollisionPoint(leftWandTip, rightWandTip, -500)).toEqual(leftWandTip);
    expect(calculateBeamCollisionPoint(leftWandTip, rightWandTip, 500)).toEqual(rightWandTip);
  });

  it('supports coincident wand positions without producing invalid coordinates', () => {
    const sameTip = { x: 75, y: 125 };

    expect(calculateBeamCollisionPoint(sameTip, sameTip, 60)).toEqual(sameTip);
  });
});
