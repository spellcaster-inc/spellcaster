import Modal from './Modal';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HowToPlayModal = ({ isOpen, onClose }: HowToPlayModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="How the Duel Works">
      <div className="space-y-4 text-slate-100">
        <section>
          <h3 className="text-lg font-semibold text-emerald-200">Objective</h3>
          <p className="text-sm text-slate-300">
            Out-SPELL your opponent across quick-fire rounds! Listen closely for the name of the spell, then spell it out quickly and accurately to maximize your points.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-emerald-200">Scoring</h3>
          <p className="text-sm text-slate-300">
            Accuracy earns up to 120 points. Cast with at least 30% accuracy to qualify for up to
            20 Typing speed bonus points—the faster the cast, the larger the bonus. Your round
            total pushes the beam.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-emerald-200">Round Flow</h3>
          <p className="text-sm text-slate-300">
            After the three-second countdown, you have ten seconds to listen, type, and cast.
            Round results remain for five seconds, or both players can skip to the next spell.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-emerald-200">Winning</h3>
          <p className="text-sm text-slate-300">
            Every accurate letter nudges your beam toward your opponent. Reach their sigil first to
            win immediately, or lead on points after the final round. Leaving or disconnecting
            during a duel forfeits the match.
          </p>
        </section>
      </div>
    </Modal>
  );
};

export default HowToPlayModal;
