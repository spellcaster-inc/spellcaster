import { useCallback, useEffect, useRef, useState } from 'react';
import type { DuelFinisherPayload, Player, RoundRecapPayload } from '../../../shared/types/socket';
import type { Wizard } from '../types/wizard';
import wizardPurple from '../assets/spellcaster-wizards/wizard-purple.png';
import wizardRed from '../assets/spellcaster-wizards/wizard-red.png';
import wizardBlue from '../assets/spellcaster-wizards/wizard-blue.png';
import wizardGreen from '../assets/spellcaster-wizards/wizard-green.png';
import wizardOrange from '../assets/spellcaster-wizards/wizard-orange.png';
import wizardGrey from '../assets/spellcaster-wizards/wizard-grey.png';
import { LightningBeam, type Point } from './LightningBeam';
import { DuelScoreIndicator } from './DuelScoreIndicator';
import { calculateBeamCollisionPoint } from '../lib/beamGeometry';
import { calculateFinisherOffset } from '../lib/beamFinisher';

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
  scores: Record<string, number>;
  beamOffset?: number;
  roundRecap?: RoundRecapPayload | null;
  localPlayerId?: string | null;
  finisher?: DuelFinisherPayload | null;
}

export function WizardBeam({ players, scores, beamOffset = 0, roundRecap, localPlayerId, finisher }: WizardBeamProps) {
  // Match the server's player order so the signed beam offset maps to consistent sides.
  const leftWizard = players[0];
  const rightWizard = players[1];
  
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
  const finisherTimeoutRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!finisher) {
      return;
    }

    finisherTimeoutRef.current = window.setTimeout(() => {
      if (beamAnimationRef.current) cancelAnimationFrame(beamAnimationRef.current);
      const target = finisher.targetBeamOffset;
      const start = currentOffsetRef.current;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        setDisplayBeamOffset(target);
        currentOffsetRef.current = target;
        return;
      }
      const startTime = performance.now();
      const animateFinisher = (time: number) => {
        const progress = Math.min((time - startTime) / finisher.durationMs, 1);
        const nextValue = calculateFinisherOffset(start, target, progress);
        setDisplayBeamOffset(nextValue);
        currentOffsetRef.current = nextValue;
        if (progress < 1) beamAnimationRef.current = requestAnimationFrame(animateFinisher);
      };
      beamAnimationRef.current = requestAnimationFrame(animateFinisher);
    }, Math.max(0, finisher.startsInMs));

    return () => {
      if (finisherTimeoutRef.current !== null) {
        window.clearTimeout(finisherTimeoutRef.current);
        finisherTimeoutRef.current = null;
      }
    };
  }, [finisher]);

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
      if (finisherTimeoutRef.current !== null) {
        window.clearTimeout(finisherTimeoutRef.current);
      }
      if (beamAnimationRef.current) {
        cancelAnimationFrame(beamAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (leftHopProgress === 0 && rightHopProgress === 0) return;
    updateWandPositions();
  }, [leftHopProgress, rightHopProgress, updateWandPositions]);

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

  const collisionPoint =
    leftWandTip && rightWandTip
      ? calculateBeamCollisionPoint(leftWandTip, rightWandTip, displayBeamOffset)
      : null;
  
  // Determine if beams should be active (during duel, when both wizards are present and we have positions)
  const beamsActive = Boolean(
    leftWizard && 
    rightWizard && 
    leftWandTip && 
    rightWandTip && 
    collisionPoint &&
    leftWizardData &&
    rightWizardData
  );

  const leftHopOffset = -Math.sin(leftHopProgress * Math.PI) * 34;
  const rightHopOffset = -Math.sin(rightHopProgress * Math.PI) * 34;
  const leftHopScale = 1 + leftHopProgress * 0.05;
  const rightHopScale = 1 + rightHopProgress * 0.05;

  const leftColor = leftWizardData?.color ?? '#ffffff';
  const rightColor = rightWizardData?.color ?? '#ffffff';
  const scoreColors: Record<string, string> = {};
  if (leftWizard) scoreColors[leftWizard.id] = leftColor;
  if (rightWizard) scoreColors[rightWizard.id] = rightColor;

  return (
    <div 
      ref={containerRef}
      className="card-glow rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[0_30px_50px_rgba(4,0,23,0.7)] backdrop-blur-2xl sm:p-6"
    >
      <div className="relative flex h-60 items-end justify-between px-2 pt-16 sm:px-4">
        <div className="absolute inset-x-2 top-2 z-50 sm:inset-x-4 sm:top-3">
          <DuelScoreIndicator
            players={players}
            scores={scores}
            localPlayerId={localPlayerId ?? null}
            playerColors={scoreColors}
          />
        </div>

        {/* Left Wizard */}
        {leftWizard && leftWizardData && (
          <div className="flex w-24 flex-col items-center gap-2 sm:w-28" style={{ zIndex: 5, position: 'relative' }}>
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
            <p
              className="w-full truncate text-center text-xs font-incantation text-white sm:text-sm"
              title={`${leftWizard.name}${leftWizard.id === localPlayerId ? ' (you)' : ''}`}
            >
              {leftWizard.name}
              {leftWizard.id === localPlayerId && (
                <span className="ml-1 text-xs text-emerald-300">(you)</span>
              )}
            </p>
          </div>
        )}

        {/* Right Wizard (Mirrored) */}
        {rightWizard && rightWizardData && (
          <div className="flex w-24 flex-col items-center gap-2 sm:w-28" style={{ zIndex: 5, position: 'relative', isolation: 'auto' }}>
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
            <p
              className="w-full truncate text-center text-xs font-incantation text-white sm:text-sm"
              title={`${rightWizard.name}${rightWizard.id === localPlayerId ? ' (you)' : ''}`}
            >
              {rightWizard.name}
              {rightWizard.id === localPlayerId && (
                <span className="ml-1 text-xs text-emerald-300">(you)</span>
              )}
            </p>
          </div>
        )}

        {/* Lightning Beams Overlay - Two separate beams, one from each wizard */}
        {beamsActive && leftWandTip && rightWandTip && collisionPoint && leftWizardData && rightWizardData && (
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
              end={collisionPoint}
              color={leftWizardData.color}
              thickness={7}
              glowSize={24}
              active={beamsActive}
            />
            {/* Right wizard's beam - equal length from right wand tip */}
            <LightningBeam
              start={rightWandTip}
              end={collisionPoint}
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
