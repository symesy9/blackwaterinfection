import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type LockdownPhase = "boot" | "glitch" | "active";
type Highlight = "alert" | "professor" | "critical";

type LogEntry = {
  time: string;
  label: string;
  value: string;
  highlight?: Highlight;
};

type SequenceItem =
  | { id: string; kind: "text"; text: string; className?: string }
  | { id: string; kind: "entry"; entry: LogEntry }
  | { id: string; kind: "corrupt"; text: string; faded?: boolean; separator?: boolean };

const LOG_ENTRY_TEMPLATES: Omit<LogEntry, "time">[] = [
  { label: "EVENT", value: "UNAUTHORISED ACCESS DETECTED", highlight: "alert" },
  { label: "SECTOR", value: "C-7" },
  { label: "CLEARANCE USED", value: "PROFESSOR", highlight: "professor" },
  { label: "ENTRY", value: "ACCEPTED" },
  { label: "EXIT", value: "NO RECORD", highlight: "critical" },
  { label: "LOCKDOWN INITIATED", value: "03:17:00" },
];

const LOCKDOWN_TIME = "03:17:00";

function formatLogTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

function buildLogEntries(): LogEntry[] {
  const startSeconds = 3 * 3600 + 16 * 60 + 13;

  return LOG_ENTRY_TEMPLATES.map((entry, index) => {
    const isLockdown = entry.label === "LOCKDOWN INITIATED";

    return {
      ...entry,
      time: isLockdown ? LOCKDOWN_TIME : formatLogTime(startSeconds + index),
    };
  });
}

const LOG_ENTRIES = buildLogEntries();

type DenialLine = {
  id: string;
  time: string;
  text: string;
};

const CHAR_DELAY_MS = 32;
const LINE_PAUSE_MS = 480;
const START_DELAY_MS = 700;

function formatEntryLine(entry: LogEntry) {
  return `[${entry.time}] ${entry.label}: ${entry.value}`;
}

function valueClassName(highlight?: Highlight) {
  if (highlight === "alert") return "fl-log__value fl-log__value--alert";
  if (highlight === "professor") return "fl-log__value fl-log__value--professor";
  if (highlight === "critical") return "fl-log__value fl-log__value--critical";
  return "fl-log__value";
}

function renderEntry(entry: LogEntry) {
  return (
    <>
      <span className="fl-log__time">[{entry.time}]</span>{" "}
      <span className="fl-log__label">{entry.label}:</span>{" "}
      <span className={valueClassName(entry.highlight)}>{entry.value}</span>
    </>
  );
}

function renderSequenceItem(item: SequenceItem): ReactNode {
  if (item.kind === "entry") {
    return renderEntry(item.entry);
  }

  if (item.kind === "corrupt") {
    return item.text;
  }

  return item.text;
}

function getSequenceText(item: SequenceItem) {
  if (item.kind === "entry") {
    return formatEntryLine(item.entry);
  }

  return item.text;
}

function TypingCursor({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <span className="fl-log__cursor" aria-hidden="true">
      ▌
    </span>
  );
}

export default function FacilityLockdownOverlay() {
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const sequence = useMemo<SequenceItem[]>(
    () => [
      { id: "header", kind: "text", text: "> ACCESS LOG // RECOVERED", className: "fl-log__file-header" },
      {
        id: "meta",
        kind: "text",
        text: "FILE: sector_C-7_access.rec | STATUS: PARTIAL RECOVERY",
        className: "fl-log__file-meta",
      },
      ...LOG_ENTRIES.map((entry) => ({
        id: entry.label,
        kind: "entry" as const,
        entry,
      })),
      { id: "corrupt-1", kind: "corrupt", text: "> RECORD INCOMPLETE", separator: true },
      { id: "corrupt-2", kind: "corrupt", text: "> FURTHER DATA CORRUPTED", faded: true },
    ],
    [],
  );

  const [phase, setPhase] = useState<LockdownPhase>(() => (reducedMotion ? "active" : "boot"));
  const [lineIndex, setLineIndex] = useState(reducedMotion ? sequence.length : 0);
  const [charIndex, setCharIndex] = useState(0);
  const [typingStarted, setTypingStarted] = useState(reducedMotion);
  const [passcode, setPasscode] = useState("");
  const [denialLines, setDenialLines] = useState<DenialLine[]>([]);
  const [denialAttempt, setDenialAttempt] = useState(0);

  const typingComplete = lineIndex >= sequence.length;
  const currentItem = sequence[lineIndex];
  const currentText = currentItem ? getSequenceText(currentItem).slice(0, charIndex) : "";

  useEffect(() => {
    if (reducedMotion) return;

    const glitchTimer = window.setTimeout(() => setPhase("glitch"), 400);
    const activeTimer = window.setTimeout(() => setPhase("active"), 560);

    return () => {
      window.clearTimeout(glitchTimer);
      window.clearTimeout(activeTimer);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (phase !== "active" || typingStarted || reducedMotion) return;

    const startTimer = window.setTimeout(() => setTypingStarted(true), START_DELAY_MS);
    return () => window.clearTimeout(startTimer);
  }, [phase, typingStarted, reducedMotion]);

  useEffect(() => {
    if (!typingStarted || typingComplete || reducedMotion || !currentItem) return;

    const fullText = getSequenceText(currentItem);

    if (charIndex >= fullText.length) {
      const pauseTimer = window.setTimeout(() => {
        setLineIndex((index) => index + 1);
        setCharIndex(0);
      }, LINE_PAUSE_MS);

      return () => window.clearTimeout(pauseTimer);
    }

    const charTimer = window.setTimeout(() => {
      setCharIndex((index) => index + 1);
    }, CHAR_DELAY_MS);

    return () => window.clearTimeout(charTimer);
  }, [typingStarted, typingComplete, reducedMotion, currentItem, charIndex, lineIndex]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    html.classList.add("fl-lockdown-active");
    body.classList.add("fl-lockdown-active");

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.classList.remove("fl-lockdown-active");
      body.classList.remove("fl-lockdown-active");
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const phaseClass =
    phase === "boot"
      ? "fl-lockdown--boot"
      : phase === "glitch"
        ? "fl-lockdown--glitch"
        : "fl-lockdown--active";

  const statusSecondary = typingComplete
    ? "RECOVERED ENTRY — READ ONLY"
    : typingStarted
      ? "LIVE CAPTURE — LOGGING"
      : "AWAITING LOG STREAM";

  const chromeMeta = typingComplete ? "RECOVERED" : typingStarted ? "LOGGING..." : "STANDBY";

  function handlePasscodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = passcode.trim();
    if (!trimmed) return;

    const attemptSeconds = 3 * 3600 + 17 * 60 + 1 + denialAttempt;

    setDenialLines((lines) => [
      ...lines,
      {
        id: `denial-submit-${denialAttempt}`,
        time: formatLogTime(attemptSeconds),
        text: "PASSCODE SUBMITTED",
      },
      {
        id: `denial-result-${denialAttempt}`,
        time: formatLogTime(attemptSeconds),
        text: "ACCESS REQUEST: DENIED — INSUFFICIENT CLEARANCE",
      },
    ]);
    setDenialAttempt((count) => count + 1);
    setPasscode("");
  }

  return createPortal(
    <div
      className={`fl-lockdown ${phaseClass}`}
      role="region"
      aria-label="Recovered Blackwater Labs security access log"
    >
      <div className="fl-lockdown__sr">
        Recovered security access log. Unauthorised access detected in sector C-7 at
        03:16:13. No exit record found.
      </div>

      <header className="fl-status">
        <p className="fl-status__primary">
          <span className="fl-status__indicator" aria-hidden="true">
            ●
          </span>
          BLACKWATER LABS // SECURITY ACCESS LOG
        </p>
        <p className="fl-status__secondary">{statusSecondary}</p>
      </header>

      <div className="fl-layer fl-layer--dark" aria-hidden="true" />
      <div className="fl-layer fl-layer--ambient" aria-hidden="true" />
      <div className="fl-layer fl-layer--vignette" aria-hidden="true" />
      <div className="fl-layer fl-layer--grain" aria-hidden="true" />
      <div className="fl-layer fl-layer--scanlines" aria-hidden="true" />
      <div className="fl-layer fl-layer--static" aria-hidden="true" />

      <article className="fl-log">
        <div className="fl-log__chrome" aria-hidden="true">
          <span className="fl-log__chrome-dot fl-log__chrome-dot--a" />
          <span className="fl-log__chrome-dot fl-log__chrome-dot--b" />
          <span className="fl-log__chrome-dot fl-log__chrome-dot--c" />
          <span className="fl-log__chrome-title">access_log_C7.rec</span>
          <span className="fl-log__chrome-meta">{chromeMeta}</span>
        </div>

        <div className="fl-log__body">
          <div className="fl-log__stream" role="log" aria-label="Recovered access log entries">
            {sequence.slice(0, lineIndex).map((item) => {
              if (item.kind === "text") {
                return (
                  <p key={item.id} className={item.className ?? "fl-log__line"}>
                    {renderSequenceItem(item)}
                  </p>
                );
              }

              if (item.kind === "corrupt") {
                const corruptClass = [
                  "fl-log__corrupt-line",
                  item.faded ? "fl-log__corrupt-line--fade" : "",
                  "fl-log__corrupt-line--done",
                  item.separator ? "fl-log__corrupt-line--separator" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <p key={item.id} className={corruptClass}>
                    {renderSequenceItem(item)}
                  </p>
                );
              }

              return (
                <p key={item.id} className="fl-log__line">
                  {renderSequenceItem(item)}
                </p>
              );
            })}

            {!typingComplete && currentItem ? (
              currentItem.kind === "text" ? (
                <p className={currentItem.className ?? "fl-log__line fl-log__line--typing"}>
                  {currentText}
                  <TypingCursor visible={typingStarted} />
                </p>
              ) : currentItem.kind === "corrupt" ? (
                <p
                  className={[
                    "fl-log__corrupt-line",
                    "fl-log__line--typing",
                    currentItem.faded ? "fl-log__corrupt-line--fade" : "",
                    currentItem.separator ? "fl-log__corrupt-line--separator" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {currentText}
                  <TypingCursor visible={typingStarted} />
                </p>
              ) : (
                <p className="fl-log__line fl-log__line--typing">
                  {currentText}
                  <TypingCursor visible={typingStarted} />
                </p>
              )
            ) : null}

            {typingComplete ? (
              <p className="fl-log__prompt" aria-hidden="true">
                <span className="fl-log__prompt-text">&gt; END OF RECOVERED LOG</span>
                <TypingCursor visible />
              </p>
            ) : null}

            {denialLines.map((line) => (
              <p key={line.id} className="fl-log__line fl-log__line--denied">
                <span className="fl-log__time">[{line.time}]</span>{" "}
                <span className="fl-log__value fl-log__value--denied">{line.text}</span>
              </p>
            ))}
          </div>

          {typingComplete ? (
            <form className="fl-passcode" onSubmit={handlePasscodeSubmit}>
              <label className="fl-passcode__label" htmlFor="fl-passcode-input">
                ENTER FACILITY PASSCODE
              </label>
              <div className="fl-passcode__row">
                <span className="fl-passcode__prompt" aria-hidden="true">
                  &gt;
                </span>
                <input
                  id="fl-passcode-input"
                  className="fl-passcode__input"
                  type="password"
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="fl-passcode-hint"
                />
                <button className="fl-passcode__submit" type="submit">
                  SUBMIT
                </button>
              </div>
              <p id="fl-passcode-hint" className="fl-passcode__hint">
                Override clearance required. All attempts are logged.
              </p>
            </form>
          ) : null}
        </div>
      </article>

      <div className="fl-blocker" aria-hidden="true" />
    </div>,
    document.body,
  );
}
