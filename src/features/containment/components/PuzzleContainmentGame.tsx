import { useCallback, useEffect, useRef, useState } from "react";
import { ContainmentPuzzleSimulation } from "../engine/puzzle/ContainmentPuzzleSimulation";
import { PuzzleBoardRenderer } from "../rendering/PuzzleBoardRenderer";
import { CameraController } from "../rendering/CameraController";
import { AudioManager } from "../audio/AudioManager";
import { loadPersistence, recordBestRun, savePersistence } from "../persistence/storage";
import type { PuzzleMode, PuzzleSnapshot } from "../types/puzzle";
import PuzzleHud from "./PuzzleHud";
import PuzzleModeBar from "./PuzzleModeBar";
import PuzzleGameOverPanel from "./PuzzleGameOverPanel";
import PuzzleHowToPlay from "./PuzzleHowToPlay";
import PuzzlePauseMenu from "./PuzzlePauseMenu";
import PuzzleStageClear from "./PuzzleStageClear";

const HINT_TEXT = [
  "SCAN A ROOM",
  "NUMBERS SHOW NEARBY INFECTION",
  "LOCK THE HIGHLIGHTED INFECTION",
];

interface PuzzleContainmentGameProps {
  onReturn: () => void;
}

export default function PuzzleContainmentGame({ onReturn }: PuzzleContainmentGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<ContainmentPuzzleSimulation | null>(null);
  const rendererRef = useRef<PuzzleBoardRenderer | null>(null);
  const cameraRef = useRef(new CameraController());
  const audioRef = useRef(new AudioManager());
  const rafRef = useRef<number>(0);
  const recordedRef = useRef(false);

  const [snapshot, setSnapshot] = useState<PuzzleSnapshot | null>(null);
  const [persisted, setPersisted] = useState(loadPersistence);
  const [showPause, setShowPause] = useState(false);
  const [uiMode, setUiMode] = useState<PuzzleMode>("scan");
  const lastStageRef = useRef(0);

  const syncScanMode = useCallback(() => {
    simRef.current?.setMode("scan");
    setUiMode("scan");
  }, []);

  const [showHowToPlay, setShowHowToPlay] = useState(false);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.hint === 2 && snapshot.mode === "lock") {
      setUiMode("lock");
    }
  }, [snapshot?.hint, snapshot?.mode]);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.stage !== lastStageRef.current) {
      lastStageRef.current = snapshot.stage;
      syncScanMode();
    }
  }, [snapshot?.stage, syncScanMode]);

  const startGame = useCallback((seed?: number) => {
    lastStageRef.current = 0;
    syncScanMode();
    const p = loadPersistence();
    const gameSeed =
      seed ??
      (((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0) || 1);
    const sim = new ContainmentPuzzleSimulation(gameSeed);
    if (p.tutorialComplete) sim.skipHints();
    simRef.current = sim;
    recordedRef.current = false;
    setSnapshot(sim.getSnapshot());
    setShowPause(false);
  }, [syncScanMode]);

  useEffect(() => {
    startGame();
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioRef.current.dispose();
    };
  }, [startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new PuzzleBoardRenderer(canvas);
    } catch {
      return;
    }
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent && rendererRef.current) {
        rendererRef.current.resize(parent.clientWidth, parent.clientHeight);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    rendererRef.current?.setReducedMotion(persisted.reducedMotion);
    audioRef.current.setMuted(persisted.muted);
  }, [persisted.reducedMotion, persisted.muted]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && persisted.autoPauseOnHide) {
        simRef.current?.pause();
        setShowPause(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [persisted.autoPauseOnHide]);

  useEffect(() => {
    const loop = (now: number) => {
      const sim = simRef.current;
      const renderer = rendererRef.current;

      if (sim && !sim.isPaused() && sim.phase === "playing") {
        sim.update(now);
        for (const ev of sim.drainEvents()) {
          if (ev.type === "safe_reveal") audioRef.current.play("confirm", 0.4);
          if (ev.type === "infected_reveal" || ev.type === "outbreak") {
            audioRef.current.play("door_stress", 0.7);
          }
          if (ev.type === "lock_applied") audioRef.current.play("door_seal");
          if (ev.type === "spread") {
            renderer?.noteSpread(ev.fromId, ev.toId);
            audioRef.current.play("mutation", 0.5);
          }
          if (ev.type === "core_exposure") audioRef.current.play("door_stress", 0.6);
          if (ev.type === "core_breach") audioRef.current.play("game_over");
          if (ev.type === "stage_clear") audioRef.current.play("serum", 0.6);
        }
      }

      if (sim) {
        const snap = sim.getSnapshot();
        setSnapshot(snap);

        if (snap.phase === "game_over" && !recordedRef.current) {
          recordedRef.current = true;
          const updated = recordBestRun(sim.computeScore(), snap.elapsedMs, snap.seed);
          setPersisted(updated);
          if (snap.hint < 3) savePersistence({ tutorialComplete: true });
        }

        if (renderer) {
          renderer.render(snap, cameraRef.current.state);
          sim.clearCluePulses();
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (snapshot?.phase !== "stage_clear") return;
    const t = window.setTimeout(() => {
      simRef.current?.advanceStage();
      syncScanMode();
    }, 1400);
    return () => window.clearTimeout(t);
  }, [snapshot?.phase, snapshot?.stage, syncScanMode]);

  const actOnCell = (cellId: string, mode: PuzzleMode) => {
    audioRef.current.unlock();
    const sim = simRef.current;
    if (!sim || sim.phase !== "playing") return;
    sim.actOnCell(cellId, mode);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const wasTap = cameraRef.current.endPointer();
    if (!wasTap) return;

    const sim = simRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!sim || !renderer || !canvas || sim.phase !== "playing") return;

    const rect = canvas.getBoundingClientRect();
    const cellId = renderer.hitTestCell(
      sim.getSnapshot(),
      cameraRef.current.state,
      rect.width,
      rect.height,
      e.clientX - rect.left,
      e.clientY - rect.top,
    );
    if (!cellId) return;

    const mode: PuzzleMode = e.button === 2 ? "lock" : uiMode;
    actOnCell(cellId, mode);
  };

  const snap = snapshot;
  const hintText =
    snap && snap.hint < 3 ? HINT_TEXT[snap.hint] : snap?.message ?? "PROTECT THE CORE";

  return (
    <div className="cp-game cp-game--puzzle">
      {snap && snap.phase !== "game_over" && (
        <PuzzleHud
          stage={snap.stage}
          score={snap.score}
          locks={snap.locks}
          spreadCountdownMs={snap.spreadCountdownMs}
          message={hintText}
          bestScore={persisted.bestScore}
          onPause={() => {
            simRef.current?.pause();
            setShowPause(true);
          }}
          onHowToPlay={() => setShowHowToPlay(true)}
          onReturn={onReturn}
        />
      )}

      <div
        className="cp-board-wrap cp-board-wrap--puzzle"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("canvas")) {
            cameraRef.current.beginPointer(e.clientX, e.clientY);
          }
        }}
        onPointerMove={(e) => cameraRef.current.movePointer(e.clientX, e.clientY)}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          className="cp-board-canvas"
          aria-label="Containment hex board — scan or lock cells"
        />
        <div className="cp-board-controls">
          <button type="button" onClick={() => cameraRef.current.recenter()} aria-label="Recenter">
            ⊕
          </button>
        </div>
      </div>

      {snap?.phase === "playing" && (
        <PuzzleModeBar
          key={`mode-stage-${snap.stage}`}
          mode={uiMode}
          onModeChange={(mode) => {
            setUiMode(mode);
            simRef.current?.setMode(mode);
          }}
        />
      )}

      {snap?.phase === "stage_clear" && (
        <PuzzleStageClear stage={snap.stage} score={snap.score} />
      )}

      {showPause && (
        <PuzzlePauseMenu
          onResume={() => {
            simRef.current?.resume();
            setShowPause(false);
          }}
          onTryAgain={() => startGame(simRef.current?.seed)}
          onNewIncident={() => startGame()}
          onHowToPlay={() => setShowHowToPlay(true)}
          onReturn={onReturn}
        />
      )}

      {showHowToPlay && <PuzzleHowToPlay onClose={() => setShowHowToPlay(false)} />}

      {snap?.phase === "game_over" && (
        <PuzzleGameOverPanel
          stage={snap.stage}
          score={snap.score}
          bestScore={persisted.bestScore}
          onTryAgain={() => startGame(snap.seed)}
          onNewIncident={() => startGame()}
          onReturn={onReturn}
        />
      )}
    </div>
  );
}
