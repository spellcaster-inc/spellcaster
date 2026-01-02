import { useCallback, useEffect, useRef, useState } from 'react';
import type { Player, RoundRecapPayload } from '../../../shared/types/socket';
import type { Wizard } from '../types/wizard';
import wizardPurple from '../assets/spellcaster-wizards/wizard-purple.png';
import wizardRed from '../assets/spellcaster-wizards/wizard-red.png';
import wizardBlue from '../assets/spellcaster-wizards/wizard-blue.png';
import wizardGreen from '../assets/spellcaster-wizards/wizard-green.png';
import wizardOrange from '../assets/spellcaster-wizards/wizard-orange.png';
import wizardGrey from '../assets/spellcaster-wizards/wizard-grey.png';
import { LightningBeam, type Point } from './LightningBeam';

const WIZARDS: Wizard[] = [
  {
    id: 'violet-warden',
    name: 'Violet Vowel',
    color: '#a78bfa',
    description: 'Calm focus. Loves perfect cadence.',
    imageUrl: wizardPurple,
  },
  {
    id: 'crimson-aegis',
    name: 'Red Rhyme',
    color: '#f87171',
    description: 'Aggressive caster with fiery streaks.',
    imageUrl: wizardRed,
  },
  {
    id: 'azure-sage',
    name: 'Blue Backspace',
    color: '#38bdf8',
    description: 'Quick thinker, thrives on momentum.',
    imageUrl: wizardBlue,
  },
  {
    id: 'emerald-scribe',
    name: 'Green Grammar',
    color: '#34d399',
    description: 'Lore keeper of the dueling halls.',
    imageUrl: wizardGreen,
  },
  {
    id: 'golden-starling',
    name: 'Orange Oops',
    color: '#fcd34d',
    description: 'Flashy tactician — accuracy under pressure.',
    imageUrl: wizardOrange,
  },
  {
    id: 'obsidian-mage',
    name: 'Grey Ghostwriter',
    color: '#94a3b8',
    description: 'Steady and unshakable aura.',
    imageUrl: wizardGrey,
  },
];

interface WizardBeamProps {
  players: Player[];
  beamOffset?: number;
  roundRecap?: RoundRecapPayload | null;
  localPlayerId?: string | null;
}

export function WizardBeam({ players, beamOffset = 0, roundRecap, localPlayerId }: WizardBeamProps) {
  // Ensure we have both players, with host on left
  const hostPlayer = players.find(p => p.isHost);
  const nonHostPlayer = players.find(p => !p.isHost);
  const leftWizard = hostPlayer ?? players[0];
  const rightWizard = nonHostPlayer ?? players[1];
  
  const [leftHopProgress, setLeftHopProgress] = useState(0);
  const [rightHopProgress, setRightHopProgress] = useState(0);
  const prevRoundNumberRef = useRef<number | null>(null);

  // Refs for wand tip positions
  const containerRef = useRef<HTMLDivElement>(null);
  const leftWandTipRef = useRef<HTMLDivElement>(null);
  const rightWandTipRef = useRef<HTMLDivElement>(null);
  const [leftWandTip, setLeftWandTip] = useState<Point | null>(null);
  const [rightWandTip, setRightWandTip] = useState<Point | null>(null);

  const getWizardForPlayer = (wizardId?: string): Wizard | null => {
    if (!wizardId) return WIZARDS[0]; // Default to purple
    return WIZARDS.find((w) => w.id === wizardId) ?? WIZARDS[0];
  };

  const leftWizardData = leftWizard ? getWizardForPlayer(leftWizard.wizardId) : null;
  const rightWizardData = rightWizard ? getWizardForPlayer(rightWizard.wizardId) : null;


  // Update wand tip positions
  const updateWandPositions = useCallback(() => {
    if (!containerRef.current) {
      setLeftWandTip(null);
      setRightWandTip(null);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();

    // Calculate left wand tip position
    if (leftWandTipRef.current) {
      const leftRect = leftWandTipRef.current.getBoundingClientRect();
      const x = leftRect.left + leftRect.width / 2 - containerRect.left;
      const y = leftRect.top + leftRect.height / 2 - containerRect.top;
      
      // Only update if we have valid coordinates
      if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
        setLeftWandTip({ x, y });
      }
    } else {
      setLeftWandTip(null);
    }

    // Calculate right wand tip position
    if (rightWandTipRef.current) {
      const rightRect = rightWandTipRef.current.getBoundingClientRect();
      const x = rightRect.left + rightRect.width / 2 - containerRect.left;
      const y = rightRect.top + rightRect.height / 2 - containerRect.top;
      
      // Only update if we have valid coordinates
      if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
        setRightWandTip({ x, y });
      }
    } else {
      setRightWandTip(null);
    }
  }, []);

  const [displayBeamOffset, setDisplayBeamOffset] = useState(beamOffset);
  const beamAnimationRef = useRef<number | null>(null);
  const currentOffsetRef = useRef(beamOffset);

  useEffect(() => {
    currentOffsetRef.current = displayBeamOffset;
  }, [displayBeamOffset]);

  useEffect(() => {
    if (beamAnimationRef.current) {
      cancelAnimationFrame(beamAnimationRef.current);
    }

    const duration = 450;
    const start = currentOffsetRef.current;
    const delta = beamOffset - start;

    if (Math.abs(delta) < 0.01) {
      setDisplayBeamOffset(beamOffset);
      currentOffsetRef.current = beamOffset;
      return;
    }

    const startTime = performance.now();

    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const nextValue = start + delta * eased;

      setDisplayBeamOffset(nextValue);
      currentOffsetRef.current = nextValue;

      if (progress < 1) {
        beamAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    beamAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (beamAnimationRef.current) {
        cancelAnimationFrame(beamAnimationRef.current);
        beamAnimationRef.current = null;
      }
    };
  }, [beamOffset]);

  const leftHopAnimationRef = useRef<number | null>(null);
  const rightHopAnimationRef = useRef<number | null>(null);

  const runHopAnimation = useCallback((side: 'left' | 'right') => {
    const duration = 600;
    const startTime = performance.now();

    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const hopValue = Math.sin(progress * Math.PI);

      if (side === 'left') {
        setLeftHopProgress(hopValue);
      } else {
        setRightHopProgress(hopValue);
      }

      if (progress < 1) {
        const frame = requestAnimationFrame(animate);
        if (side === 'left') {
          leftHopAnimationRef.current = frame;
        } else {
          rightHopAnimationRef.current = frame;
        }
      } else {
        if (side === 'left') {
          setLeftHopProgress(0);
          leftHopAnimationRef.current = null;
        } else {
          setRightHopProgress(0);
          rightHopAnimationRef.current = null;
        }
      }
    };

    if (side === 'left' && leftHopAnimationRef.current) {
      cancelAnimationFrame(leftHopAnimationRef.current);
    }
    if (side === 'right' && rightHopAnimationRef.current) {
      cancelAnimationFrame(rightHopAnimationRef.current);
    }

    const frame = requestAnimationFrame(animate);
    if (side === 'left') {
      leftHopAnimationRef.current = frame;
    } else {
      rightHopAnimationRef.current = frame;
    }
  }, []);

  // Detect round completion and trigger hop animation for winning player
  useEffect(() => {
    if (roundRecap && roundRecap.winningPlayerId && roundRecap.roundNumber !== prevRoundNumberRef.current) {
      if (roundRecap.winningPlayerId === leftWizard?.id) {
        runHopAnimation('left');
      } else if (roundRecap.winningPlayerId === rightWizard?.id) {
        runHopAnimation('right');
      }
      
      prevRoundNumberRef.current = roundRecap.roundNumber;
    }
  }, [roundRecap, leftWizard?.id, rightWizard?.id, runHopAnimation]);

  useEffect(() => {
    return () => {
      if (leftHopAnimationRef.current) {
        cancelAnimationFrame(leftHopAnimationRef.current);
      }
      if (rightHopAnimationRef.current) {
        cancelAnimationFrame(rightHopAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (leftHopProgress === 0 && rightHopProgress === 0) return;
    updateWandPositions();
  }, [leftHopProgress, rightHopProgress, updateWandPositions]);

  // Calculate beam endpoints - both beams extend the same distance toward the center
  // This ensures both beams are equal length and meet in the middle
  const calculateBeamEndpoints = (): { leftEnd: Point; rightEnd: Point } | null => {
    if (!leftWandTip || !rightWandTip || !containerRef.current) {
      return null;
    }

    // Calculate the distance and direction between the two wand tips
    const dx = rightWandTip.x - leftWandTip.x;
    const dy = rightWandTip.y - leftWandTip.y;
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
    const halfDistance = totalDistance / 2;

    // Normalize beamOffset from [-100, 100] to adjust where beams meet
    // 0 = center, positive = right wins, negative = left wins
    const offsetPercent = displayBeamOffset / 100; // -1 to 1
    const offsetDistance = (halfDistance * offsetPercent) * 0.3; // Scale down the offset for subtlety

    // Both beams extend the same distance toward the center, with slight offset based on beamOffset
    // Left beam extends from left wand tip toward the center (to the right)
    const leftEnd: Point = {
      x: leftWandTip.x + (dx / totalDistance) * (halfDistance + offsetDistance),
      y: leftWandTip.y + (dy / totalDistance) * (halfDistance + offsetDistance),
    };

    // Right beam extends from right wand tip toward the center (to the left)
    const rightEnd: Point = {
      x: rightWandTip.x - (dx / totalDistance) * (halfDistance - offsetDistance),
      y: rightWandTip.y - (dy / totalDistance) * (halfDistance - offsetDistance),
    };

    // Ensure beams extend in the correct direction (left beam goes right, right beam goes left)
    // Left beam must extend to the right of the left wand tip
    if (leftEnd.x <= leftWandTip.x) {
      // If somehow calculated backwards, extend at least halfway
      const midX = (leftWandTip.x + rightWandTip.x) / 2;
      const midY = (leftWandTip.y + rightWandTip.y) / 2;
      leftEnd.x = midX;
      leftEnd.y = midY;
    }
    
    // Right beam must extend to the left of the right wand tip
    if (rightEnd.x >= rightWandTip.x) {
      // If somehow calculated backwards, extend at least halfway
      const midX = (leftWandTip.x + rightWandTip.x) / 2;
      const midY = (leftWandTip.y + rightWandTip.y) / 2;
      rightEnd.x = midX;
      rightEnd.y = midY;
    }

    return { leftEnd, rightEnd };
  };

  // Update positions on mount, resize, and when wizards change
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    const updatePositions = () => {
      requestAnimationFrame(() => {
        updateWandPositions();
        // Also try again after a short delay to catch any late layout changes
        setTimeout(updateWandPositions, 50);
        setTimeout(updateWandPositions, 200);
      });
    };

    updatePositions();

    const handleResize = () => {
      updateWandPositions();
    };

    window.addEventListener('resize', handleResize);
    
    // Use MutationObserver to watch for layout changes
    let observer: MutationObserver | null = null;
    if (containerRef.current) {
      observer = new MutationObserver(() => {
        updateWandPositions();
      });
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [leftWizard, rightWizard, leftWizardData, rightWizardData, updateWandPositions]);

  // Calculate beam endpoints - both beams are equal length
  const beamEndpoints = calculateBeamEndpoints();
  const collisionPoint = beamEndpoints
    ? {
        x: (beamEndpoints.leftEnd.x + beamEndpoints.rightEnd.x) / 2,
        y: (beamEndpoints.leftEnd.y + beamEndpoints.rightEnd.y) / 2,
      }
    : null;
  
  // Determine if beams should be active (during duel, when both wizards are present and we have positions)
  const beamsActive = Boolean(
    leftWizard && 
    rightWizard && 
    leftWandTip && 
    rightWandTip && 
    beamEndpoints &&
    leftWizardData &&
    rightWizardData
  );

  const leftHopOffset = -Math.sin(leftHopProgress * Math.PI) * 34;
  const rightHopOffset = -Math.sin(rightHopProgress * Math.PI) * 34;
  const leftHopScale = 1 + leftHopProgress * 0.05;
  const rightHopScale = 1 + rightHopProgress * 0.05;

  const leftColor = leftWizardData?.color ?? '#ffffff';
  const rightColor = rightWizardData?.color ?? '#ffffff';

  return (
    <div 
      ref={containerRef}
      className="card-glow rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_50px_rgba(4,0,23,0.7)] backdrop-blur-2xl"
    >
      <div className="relative h-64 flex items-end justify-between px-4">
        {/* Left Wizard */}
        {leftWizard && leftWizardData && (
          <div className="flex flex-col items-center gap-2" style={{ zIndex: 5, position: 'relative' }}>
            <div
              className="relative"
              style={{ 
                transform: `translateY(${leftHopOffset}px) scale(${leftHopScale})`,
                transition: leftHopProgress === 0 ? 'transform 0.25s ease-out' : undefined,
                willChange: 'transform',
              }}
            >
              <div className="relative w-24 h-24">
                <img
                  src={leftWizardData.imageUrl}
                  alt={leftWizardData.name}
                  className="w-full h-full object-cover rounded-full"
                />
                {/* Wand tip marker - positioned at the actual wand tip (upper-right area where wand extends) */}
                <div
                  ref={leftWandTipRef}
                  className="absolute w-2 h-2 pointer-events-none"
                  style={{ 
                    top: '10%',
                    left: '85%',
                    transform: 'translate(-50%, -50%)',
                    // Position at the wand tip - very close to right edge, upper area where wand extends outward
                  }}
                />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-incantation text-white">
                {leftWizard.name}
                {leftWizard.id === localPlayerId && (
                  <span className="text-xs text-emerald-300 ml-1">(you)</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Right Wizard (Mirrored) */}
        {rightWizard && rightWizardData && (
          <div className="flex flex-col items-center gap-2" style={{ zIndex: 5, position: 'relative', isolation: 'auto' }}>
            <div
              className="relative"
              style={{ 
                transform: `translateY(${rightHopOffset}px) scale(${rightHopScale})`,
                transition: rightHopProgress === 0 ? 'transform 0.25s ease-out' : undefined,
                willChange: 'transform',
              }}
            >
              <div className="relative w-24 h-24">
                <img
                  src={rightWizardData.imageUrl}
                  alt={rightWizardData.name}
                  className="w-full h-full object-cover rounded-full"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Wand tip marker - positioned at the actual wand tip  */}
                <div
                  ref={rightWandTipRef}
                  className="absolute w-2 h-2 pointer-events-none"
                  style={{ 
                    top: '10%',
                    left: '-35%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-incantation text-white">
                {rightWizard.name}
                {rightWizard.id === localPlayerId && (
                  <span className="text-xs text-emerald-300 ml-1">(you)</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Lightning Beams Overlay - Two separate beams, one from each wizard */}
        {beamsActive && leftWandTip && rightWandTip && beamEndpoints && leftWizardData && rightWizardData && (
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
              zIndex: 30,
              position: 'absolute',
              isolation: 'isolate',
            }}
          >
            {/* Left wizard's beam - equal length from left wand tip */}
            <LightningBeam
              start={leftWandTip}
              end={beamEndpoints.leftEnd}
              color={leftWizardData.color}
              thickness={7}
              glowSize={24}
              active={beamsActive}
            />
            {/* Right wizard's beam - equal length from right wand tip */}
            <LightningBeam
              start={rightWandTip}
              end={beamEndpoints.rightEnd}
              color={rightWizardData.color}
              thickness={7}
              glowSize={24}
              active={beamsActive}
            />
            {collisionPoint && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: collisionPoint.x,
                  top: collisionPoint.y,
                  transform: 'translate(-50%, -50%)',
                  mixBlendMode: 'screen',
                  zIndex: 40,
                }}
              >
                <div className="relative w-20 h-20">
                  <div
                    className="absolute inset-0 rounded-full blur-[22px] opacity-70 animate-ping"
                    style={{
                      background: `radial-gradient(circle, rgba(255,255,255,0.85) 0%, ${leftColor} 40%, ${rightColor} 75%, rgba(255,255,255,0) 95%)`,
                    }}
                  />
                  <div
                    className="absolute inset-1 rounded-full blur-xl opacity-85 animate-pulse"
                    style={{
                      background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${leftColor} 30%, ${rightColor} 60%, transparent 85%)`,
                      boxShadow: `0 0 20px ${leftColor}, 0 0 20px ${rightColor}`,
                    }}
                  />
                  <div
                    className="absolute inset-2 rounded-full border border-white/50 shadow-[0_0_18px_rgba(255,255,255,0.7)] animate-pulse"
                    style={{
                      background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.5) 55%, transparent 80%)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
