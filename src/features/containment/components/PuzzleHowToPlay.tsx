interface PuzzleHowToPlayProps {
  onClose: () => void;
}

export default function PuzzleHowToPlay({ onClose }: PuzzleHowToPlayProps) {
  return (
    <div className="cp-overlay">
      <div className="cp-panel cp-panel--howto">
        <h2>HOW TO PLAY</h2>
        <ul className="cp-simple-howto-list">
          <li>Reveal rooms with SCAN.</li>
          <li>Numbers show nearby infection.</li>
          <li>Lock infected rooms with LOCK.</li>
          <li>Infection spreads when the timer reaches zero.</li>
          <li>Keep it away from the Core.</li>
        </ul>
        <p className="cp-panel__hint">Desktop: left-click scan, right-click lock.</p>
        <button type="button" className="cp-panel__btn" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
