import { useEffect, useRef, useState } from 'react';

/**
 * Point type for coordinates
 */
export type Point = { x: number; y: number };

/**
 * Props for the LightningBeam component
 */
export interface LightningBeamProps {
  start: Point;        // wand tip A, in container/screen coordinates
  end: Point;          // wand tip B
  color?: string;      // base beam color for this wizard (default: blue)
  thickness?: number;  // core beam thickness (default: 6–8)
  glowSize?: number;   // width of outer glow (default: ~20–24)
  active?: boolean;    // if false, renders nothing
}

/**
 * Options for building zig-zag points
 */
interface ZigZagOptions {
  segments?: number;    // number of segments (default: 12)
  amplitude?: number;    // zig-zag amplitude in pixels (default: 20)
  phase?: number;        // animation phase for jitter
}

/**
 * Builds a zig-zag path between two points.
 * 
 * The algorithm:
 * 1. Computes the vector from start to end
 * 2. Generates points along the line at regular intervals
 * 3. Offsets each intermediate point perpendicular to the line
 * 4. Uses a sine envelope to make the zig-zag stronger in the middle, weaker at ends
 * 5. Adds time-based jitter for crackle animation
 * 
 * This produces a rigid, angular lightning-style beam, not a smooth sine wave.
 */
function buildZigZagPoints(
  start: Point,
  end: Point,
  phase: number,
  options: ZigZagOptions = {}
): Point[] {
  const { segments = 12, amplitude = 20 } = options;

  // Compute vector from start to end
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Guard against zero length
  if (length < 1) {
    return [start, end];
  }

  // Unit direction vector
  const ux = dx / length;
  const uy = dy / length;

  // Perpendicular direction (rotated 90 degrees counterclockwise)
  const nx = -uy;
  const ny = ux;

  const points: Point[] = [];

  // Generate points along the line
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Base point along the line
    const baseX = start.x + dx * t;
    const baseY = start.y + dy * t;

    // Endpoints: no offset, locked to wand tips
    if (i === 0 || i === segments) {
      points.push({ x: baseX, y: baseY });
      continue;
    }

    // Intermediate points: apply zig-zag offset
    // Alternate sides: even indices go one way, odd go the other
    const side = i % 2 === 0 ? 1 : -1;

    // Envelope: stronger in the middle, weaker at ends
    // sin(π * t) gives 0 at t=0 and t=1, 1 at t=0.5
    const envelope = Math.sin(Math.PI * t);

    // Time-based jitter for crackle effect
    // Multiple sine waves with different frequencies create organic variation
    const noise1 = Math.sin(phase + t * 10) * 0.3;
    const noise2 = Math.sin(phase * 1.7 + t * 15 + i * 3.17) * 0.2;
    const noise = 0.5 + noise1 + noise2; // Keep it roughly in [0, 1] range

    // Final offset along the perpendicular
    const offset = side * envelope * amplitude * noise;

    points.push({
      x: baseX + nx * offset,
      y: baseY + ny * offset,
    });
  }

  return points;
}

/**
 * Converts an array of points to an SVG path string
 */
function pointsToPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
}

/**
 * LightningBeam component renders an animated zig-zag lightning beam between two points.
 * 
 * The beam features:
 * - Rigid, angular zig-zag geometry (not a smooth curve)
 * - Bright core with colored outer glow
 * - Subtle animated crackle/jitter
 * - Exact endpoints at wand tips
 */
export function LightningBeam({
  start,
  end,
  color = '#38bdf8', // Default blue
  thickness = 7,
  glowSize = 24,
  active = true,
}: LightningBeamProps) {
  const [phase, setPhase] = useState(0);
  const animationFrameRef = useRef<number | null>(null);

  // Animate the phase for crackle effect
  useEffect(() => {
    if (!active) return;

    const animate = () => {
      setPhase((prev) => prev + 0.15); // Adjust speed here
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [active]);

  if (!active) {
    return null;
  }

  // Build the zig-zag path
  const points = buildZigZagPoints(start, end, phase, {
    segments: 12,
    amplitude: 20,
  });

  // Create gradient ID unique to this component instance
  const gradientId = `lightning-gradient-${color.replace('#', '')}`;
  const filterId = `lightning-glow-${color.replace('#', '')}`;

  // Calculate SVG dimensions from the bounding box of the path
  // Add padding for glow effects
  const padding = glowSize * 2;
  const minX = Math.min(start.x, end.x) - padding;
  const minY = Math.min(start.y, end.y) - padding;
  const maxX = Math.max(start.x, end.x) + padding;
  const maxY = Math.max(start.y, end.y) + padding;
  const width = maxX - minX;
  const height = maxY - minY;

  // Adjust path coordinates to be relative to the SVG viewBox
  const adjustedPath = points.map(p => ({
    x: p.x - minX,
    y: p.y - minY,
  }));
  const adjustedPathString = pointsToPath(adjustedPath);

  return (
    <svg
      className="absolute pointer-events-none"
      style={{ 
        zIndex: 5,
        left: `${minX}px`,
        top: `${minY}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        {/* Gaussian blur filter for outer glow */}
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
        </filter>

        {/* Linear gradient for core beam */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="30%" stopColor={color} stopOpacity="0.9" />
          <stop offset="70%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Outer glow layer */}
      <path
        d={adjustedPathString}
        fill="none"
        stroke={color}
        strokeWidth={glowSize}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${filterId})`}
        opacity={0.85}
      />

      {/* Core beam layer */}
      <path
        d={adjustedPathString}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

