import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { facilityLockdownAudio } from "../lib/facilityLockdownAudio";

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
const FACILITY_ATTACHMENT_PASSCODE = "2789";
const SECRET_DOCUMENT_IMAGE = `${import.meta.env.BASE_URL}assets/blackwatercode.jpg`;

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
  tone?: "denied" | "recovered";
};

type AttachmentRevealPhase = "idle" | "verify" | "glitch" | "success" | "decrypt" | "document";
type SecretDocStage = "hidden" | "loading" | "reveal" | "ready";

const CHAR_DELAY_MS = 32;
const LINE_PAUSE_MS = 480;
const START_DELAY_MS = 700;

const ATTACHMENT_REVEAL_TIMELINE = {
  glitch: 450,
  log1: 850,
  log2: 1550,
  log3: 2350,
  decrypt: 3200,
  document: 4100,
  docReveal: 5600,
  docReady: 7200,
} as const;

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
  const [revealPhase, setRevealPhase] = useState<AttachmentRevealPhase>("idle");
  const [docStage, setDocStage] = useState<SecretDocStage>("hidden");
  const attachmentTimersRef = useRef<number[]>([]);
  const logTypingSoundRef = useRef({ lineIndex: 0, charIndex: 0 });

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
    if (!typingStarted || typingComplete || reducedMotion || !currentItem) return;

    const previous = logTypingSoundRef.current;
    const advancedSameLine =
      lineIndex === previous.lineIndex && charIndex > previous.charIndex && charIndex > 0;

    if (advancedSameLine) {
      const typedChar = getSequenceText(currentItem).charAt(charIndex - 1);
      facilityLockdownAudio.playLogKeystroke(typedChar === " " ? 0.35 : 1);
    }

    logTypingSoundRef.current = { lineIndex, charIndex };
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

  useEffect(
    () => () => {
      attachmentTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      attachmentTimersRef.current = [];
      facilityLockdownAudio.dispose();
    },
    [],
  );

  function skipTyping() {
    facilityLockdownAudio.unlock();
    setPhase("active");
    setTypingStarted(true);
    setLineIndex(sequence.length);
    setCharIndex(0);
    logTypingSoundRef.current = { lineIndex: sequence.length, charIndex: 0 };
  }

  function handlePasscodeChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    facilityLockdownAudio.unlock();

    if (nextValue.length > passcode.length) {
      facilityLockdownAudio.playPasscodeKeystroke();
    }

    setPasscode(nextValue);
  }

  const phaseClass =
    phase === "boot"
      ? "fl-lockdown--boot"
      : phase === "glitch"
        ? "fl-lockdown--glitch"
        : "fl-lockdown--active";

  const revealClass =
    revealPhase === "verify"
      ? "fl-lockdown--decrypt-verify"
      : revealPhase === "glitch"
        ? "fl-lockdown--decrypt-glitch"
        : revealPhase === "success"
          ? "fl-lockdown--decrypt-success"
          : revealPhase === "decrypt"
            ? "fl-lockdown--decrypt-sequence"
            : "";

  const chromeMeta = typingComplete ? "RECOVERED" : typingStarted ? "LOGGING..." : "STANDBY";

  const secretDocVisible = revealPhase === "document";
  const isAttachmentSequenceActive = revealPhase !== "idle";

  const statusSecondary = secretDocVisible
    ? "ATTACHMENT RECOVERED — READ ONLY"
    : revealPhase === "decrypt"
      ? "DECRYPTING ATTACHMENT..."
      : revealPhase === "success" || revealPhase === "glitch"
        ? "PARTIAL CLEARANCE MATCH"
        : revealPhase === "verify"
          ? "VERIFYING OVERRIDE CLEARANCE..."
          : typingComplete
            ? "RECOVERED ENTRY — READ ONLY"
            : typingStarted
              ? "LIVE CAPTURE — LOGGING"
              : "AWAITING LOG STREAM";

  function appendAttachmentLine(
    attemptId: number,
    attemptSeconds: number,
    line: { suffix: string; text: string; tone?: DenialLine["tone"] },
  ) {
    setDenialLines((lines) => [
      ...lines,
      {
        id: `attachment-${line.suffix}-${attemptId}`,
        time: formatLogTime(attemptSeconds),
        text: line.text,
        tone: line.tone,
      },
    ]);
  }

  function startAttachmentReveal(attemptId: number, attemptSeconds: number) {
    if (reducedMotion) {
      setDenialLines((lines) => [
        ...lines,
        {
          id: `attachment-submit-${attemptId}`,
          time: formatLogTime(attemptSeconds),
          text: "PASSCODE SUBMITTED",
          tone: "recovered",
        },
        {
          id: `attachment-match-${attemptId}`,
          time: formatLogTime(attemptSeconds),
          text: "PARTIAL CLEARANCE MATCH — ATTACHMENT DECRYPTED",
          tone: "recovered",
        },
        {
          id: `attachment-denied-${attemptId}`,
          time: formatLogTime(attemptSeconds),
          text: "FACILITY ACCESS: DENIED — ATTACHMENT VIEW ONLY",
          tone: "denied",
        },
      ]);
      setRevealPhase("document");
      setDocStage("ready");
      return;
    }

    setRevealPhase("verify");

    attachmentTimersRef.current.forEach((timer) => window.clearTimeout(timer));

    const schedule = (delayMs: number, action: () => void) => {
      const timer = window.setTimeout(action, delayMs);
      attachmentTimersRef.current.push(timer);
      return timer;
    };

    [
      schedule(ATTACHMENT_REVEAL_TIMELINE.glitch, () => setRevealPhase("glitch")),
      schedule(ATTACHMENT_REVEAL_TIMELINE.log1, () => {
        setRevealPhase("success");
        appendAttachmentLine(attemptId, attemptSeconds, {
          suffix: "submit",
          text: "PASSCODE SUBMITTED",
          tone: "recovered",
        });
      }),
      schedule(ATTACHMENT_REVEAL_TIMELINE.log2, () =>
        appendAttachmentLine(attemptId, attemptSeconds, {
          suffix: "match",
          text: "PARTIAL CLEARANCE MATCH — ATTACHMENT DECRYPTED",
          tone: "recovered",
        }),
      ),
      schedule(ATTACHMENT_REVEAL_TIMELINE.log3, () =>
        appendAttachmentLine(attemptId, attemptSeconds, {
          suffix: "denied",
          text: "FACILITY ACCESS: DENIED — ATTACHMENT VIEW ONLY",
          tone: "denied",
        }),
      ),
      schedule(ATTACHMENT_REVEAL_TIMELINE.decrypt, () => setRevealPhase("decrypt")),
      schedule(ATTACHMENT_REVEAL_TIMELINE.document, () => {
        setRevealPhase("document");
        setDocStage("loading");
      }),
      schedule(ATTACHMENT_REVEAL_TIMELINE.docReveal, () => setDocStage("reveal")),
      schedule(ATTACHMENT_REVEAL_TIMELINE.docReady, () => setDocStage("ready")),
    ];
  }

  function handlePasscodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = passcode.trim();
    if (!trimmed || isAttachmentSequenceActive) return;

    const attemptSeconds = 3 * 3600 + 17 * 60 + 1 + denialAttempt;
    const attemptId = denialAttempt;

    if (trimmed === FACILITY_ATTACHMENT_PASSCODE) {
      facilityLockdownAudio.unlock();
      facilityLockdownAudio.playPasscodeSuccess();
      setDenialAttempt((count) => count + 1);
      setPasscode("");
      startAttachmentReveal(attemptId, attemptSeconds);
      return;
    }

    facilityLockdownAudio.unlock();
    facilityLockdownAudio.playPasscodeFail();

    setDenialLines((lines) => [
      ...lines,
      {
        id: `denial-submit-${attemptId}`,
        time: formatLogTime(attemptSeconds),
        text: "PASSCODE SUBMITTED",
      },
      {
        id: `denial-result-${attemptId}`,
        time: formatLogTime(attemptSeconds),
        text: "ACCESS REQUEST: DENIED — INSUFFICIENT CLEARANCE",
      },
    ]);
    setDenialAttempt((count) => count + 1);
    setPasscode("");
  }

  return createPortal(
    <div
      className={`fl-lockdown ${phaseClass} ${revealClass}`.trim()}
      role="region"
      aria-label="Recovered Blackwater Labs security access log"
      onPointerDownCapture={() => facilityLockdownAudio.unlock()}
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
          {revealPhase === "verify" || revealPhase === "glitch" ? (
            <span className="fl-status__breach" aria-hidden="true">
              {" "}
              // BREACH DETECTED
            </span>
          ) : null}
        </p>
        <p className="fl-status__secondary">{statusSecondary}</p>
      </header>

      <div className="fl-layer fl-layer--dark" aria-hidden="true" />
      <div className="fl-layer fl-layer--ambient" aria-hidden="true" />
      <div className="fl-layer fl-layer--vignette" aria-hidden="true" />
      <div className="fl-layer fl-layer--grain" aria-hidden="true" />
      <div className="fl-layer fl-layer--scanlines" aria-hidden="true" />
      <div className="fl-layer fl-layer--static" aria-hidden="true" />

      <div className="fl-log-wrap">
        {!typingComplete && phase !== "boot" ? (
          <button className="fl-log__skip" type="button" onClick={skipTyping}>
            SKIP ›
          </button>
        ) : null}

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
              <p
                key={line.id}
                className={[
                  "fl-log__line",
                  line.tone === "recovered" ? "fl-log__line--recovered" : "fl-log__line--denied",
                ].join(" ")}
              >
                <span className="fl-log__time">[{line.time}]</span>{" "}
                <span
                  className={
                    line.tone === "recovered"
                      ? "fl-log__value fl-log__value--recovered"
                      : "fl-log__value fl-log__value--denied"
                  }
                >
                  {line.text}
                </span>
              </p>
            ))}

            {revealPhase === "verify" ? (
              <div className="fl-decrypt-verify" aria-live="polite">
                <p className="fl-decrypt-verify__text">&gt; VERIFYING OVERRIDE CLEARANCE</p>
                <span className="fl-decrypt-verify__dots" aria-hidden="true">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
                <div className="fl-decrypt-verify__track" aria-hidden="true">
                  <div className="fl-decrypt-verify__fill" />
                </div>
              </div>
            ) : null}
          </div>

          {typingComplete && !isAttachmentSequenceActive ? (
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
                  onChange={handlePasscodeChange}
                  onFocus={() => facilityLockdownAudio.unlock()}
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
      </div>

      {revealPhase === "decrypt" ? (
        <div className="fl-decrypt-sequence" aria-live="polite">
          <div className="fl-decrypt-sequence__burst" aria-hidden="true" />
          <div className="fl-decrypt-sequence__panel">
            <p className="fl-decrypt-sequence__title">&gt; DECRYPTING ATTACHMENT_C7-2789.rec</p>
            <div className="fl-decrypt-sequence__track" aria-hidden="true">
              <div className="fl-decrypt-sequence__fill" />
            </div>
            <p className="fl-decrypt-sequence__status">EXTRACTING RECOVERED PAYLOAD...</p>
            <p className="fl-decrypt-sequence__hex" aria-hidden="true">
              7A4F12C8 ··· E9B03A71 ··· 44D8F20C ··· 1C9A6E55 ··· 8F2B0D93
            </p>
          </div>
        </div>
      ) : null}

      {secretDocVisible ? (
        <div
          className={`fl-secret-doc fl-secret-doc--${docStage}`}
          role="dialog"
          aria-modal="true"
          aria-label="Recovered classified attachment"
        >
          <div className="fl-secret-doc__flash" aria-hidden="true" />
          <div className="fl-secret-doc__frame">
            <header className="fl-secret-doc__header">
              <p className="fl-secret-doc__file-id">BW-SEC // ATTACHMENT_C7-2789.rec</p>
              <p className="fl-secret-doc__file-meta">
                RECOVERED FROM SECTOR C-7 ACCESS LOG · PARTIAL DECRYPTION
              </p>
            </header>

            <div className="fl-secret-doc__image-wrap">
              {docStage === "loading" ? (
                <div className="fl-secret-doc__loader" aria-hidden="true">
                  <p className="fl-secret-doc__loader-text">&gt; RENDERING RECOVERED FILE...</p>
                  <div className="fl-secret-doc__loader-noise" />
                </div>
              ) : null}
              <span
                className={`fl-secret-doc__stamp${docStage === "ready" ? " fl-secret-doc__stamp--slam" : ""}`}
                aria-hidden="true"
              >
                CLASSIFIED
              </span>
              <img
                className="fl-secret-doc__image"
                src={SECRET_DOCUMENT_IMAGE}
                alt="Recovered Blackwater Labs facility code symbols painted on a tunnel wall"
                draggable
              />
              <div className="fl-secret-doc__scanlines" aria-hidden="true" />
              <div className="fl-secret-doc__reveal-wipe" aria-hidden="true" />
            </div>

            <footer className={`fl-secret-doc__footer${docStage === "ready" ? " fl-secret-doc__footer--visible" : ""}`}>
              <p className="fl-secret-doc__notice">
                Save or screenshot this document. Facility access remains denied.
              </p>
              <div className="fl-secret-doc__actions">
                <a
                  className="fl-secret-doc__download"
                  href={SECRET_DOCUMENT_IMAGE}
                  download="blackwater-facility-code.jpg"
                >
                  DOWNLOAD
                </a>
                <button
                  className="fl-secret-doc__close"
                  type="button"
                  onClick={() => {
                    attachmentTimersRef.current.forEach((timer) => window.clearTimeout(timer));
                    attachmentTimersRef.current = [];
                    setRevealPhase("idle");
                    setDocStage("hidden");
                  }}
                >
                  RETURN TO LOG
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      <div className="fl-blocker" aria-hidden="true" />
    </div>,
    document.body,
  );
}
