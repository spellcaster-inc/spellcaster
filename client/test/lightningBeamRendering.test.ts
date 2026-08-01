import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { calculateBeamCanvasBounds, LightningBeam } from '../src/components/LightningBeam';

describe('LightningBeam glow bounds', () => {
  it('includes animated points that extend beyond both wand endpoints', () => {
    const bounds = calculateBeamCanvasBounds(
      [
        { x: 100, y: 100 },
        { x: 150, y: 62 },
        { x: 200, y: 134 },
        { x: 250, y: 100 },
      ],
      24,
    );

    expect(bounds).toEqual({
      minX: 52,
      minY: 14,
      width: 246,
      height: 168,
    });
  });

  it('uses the full SVG canvas for the glow filter instead of a path-relative box', () => {
    const markup = renderToStaticMarkup(createElement(LightningBeam, {
      start: { x: 20, y: 50 },
      end: { x: 220, y: 50 },
      glowSize: 24,
    }));

    expect(markup).toContain('filterUnits="userSpaceOnUse"');
    expect(markup).toContain('color-interpolation-filters="sRGB"');
    expect(markup).toContain('overflow="visible"');
    expect(markup).not.toContain('x="-50%"');
  });
});
