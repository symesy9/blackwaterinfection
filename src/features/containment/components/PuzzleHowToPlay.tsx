interface PuzzleHowToPlayProps {
  onClose: () => void;
}

export default function PuzzleHowToPlay({ onClose }: PuzzleHowToPlayProps) {
  return (
    <div className="cp-overlay">
      <div className="cp-panel cp-panel--howto">
        <h2>HOW TO PLAY</h2>
        <ul className="cp-simple-howto-list">
          <li>Tap a room — a menu appears beside your tap.</li>
          <li>Choose Scan to reveal, or Lock to contain infection.</li>
          <li>Tap the same room again for a quick scan.</li>
          <li>Hold a room (or right-click) to lock instantly.</li>
          <li>Numbers show nearby infection. Keep it away from the Core.</li>
        </ul>
        <p className="cp-panel__hint">The action menu floats over the board — nothing shifts at the bottom.</p>
        <button type="button" className="cp-panel__btn" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
