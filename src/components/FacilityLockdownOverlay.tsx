import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type LockdownPhase = "boot" | "glitch" | "active";

const TAPE_STRIPS = [
  {
    id: "a",
    text: "BLACKWATER LABS // FACILITY LOCKDOWN // DO NOT CROSS",
    className: "fl-tape--a",
  },
  {
    id: "b",
    text: "RESTRICTED AREA // DO NOT CROSS",
    className: "fl-tape--b",
  },
  {
    id: "c",
    text: "BIOLOGICAL CONTAINMENT // RESTRICTED",
    className: "fl-tape--c",
  },
  {
    id: "d",
    text: "BLACKWATER LABS // FACILITY LOCKDOWN // DO NOT CROSS",
    className: "fl-tape--d",
  },
] as const;

function TapeMarquee({ text, className }: { text: string; className: string }) {
  const segment = `${text}   ◆   `;

  return (
    <div className={`fl-tape ${className}`} aria-hidden="true">
      <div className="fl-tape__track">
        <div className="fl-tape__run">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={`a-${index}`} className="fl-tape__segment">
              {segment}
            </span>
          ))}
        </div>
        <div className="fl-tape__run" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={`b-${index}`} className="fl-tape__segment">
              {segment}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FacilityLockdownOverlay() {
  const [phase, setPhase] = useState<LockdownPhase>(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "active" : "boot",
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const glitchTimer = window.setTimeout(() => setPhase("glitch"), 400);
    const activeTimer = window.setTimeout(() => setPhase("active"), 560);

    return () => {
      window.clearTimeout(glitchTimer);
      window.clearTimeout(activeTimer);
    };
  }, []);

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

  return createPortal(
    <div
      className={`fl-lockdown ${phaseClass}`}
      role="alert"
      aria-live="assertive"
      aria-label="Facility lockdown active. External access suspended."
    >
      <div className="fl-lockdown__sr" aria-hidden="false">
        Facility lockdown active. External access suspended. Unauthorised access
        detected in sector C-7.
      </div>

      <header className="fl-status">
        <p className="fl-status__primary">
          <span className="fl-status__indicator" aria-hidden="true">
            ●
          </span>
          FACILITY LOCKDOWN ACTIVE
        </p>
        <p className="fl-status__secondary">EXTERNAL ACCESS SUSPENDED</p>
      </header>

      <div className="fl-layer fl-layer--dark" aria-hidden="true" />
      <div className="fl-layer fl-layer--emergency" aria-hidden="true" />
      <div className="fl-layer fl-layer--vignette" aria-hidden="true" />
      <div className="fl-layer fl-layer--fog" aria-hidden="true" />
      <div className="fl-layer fl-layer--grain" aria-hidden="true" />
      <div className="fl-layer fl-layer--scanlines" aria-hidden="true" />
      <div className="fl-layer fl-layer--static" aria-hidden="true" />

      <article className="fl-terminal">
        <p className="fl-terminal__header">⚠ FACILITY RECORD // RECOVERED</p>

        <p className="fl-terminal__alert">UNAUTHORISED ACCESS DETECTED</p>

        <dl className="fl-terminal__record">
          <div className="fl-terminal__row">
            <dt>SECTOR:</dt>
            <dd>C-7</dd>
          </div>
          <div className="fl-terminal__row">
            <dt>TIME:</dt>
            <dd>03:16:13</dd>
          </div>
          <div className="fl-terminal__row">
            <dt>CLEARANCE USED:</dt>
            <dd>
              <span className="fl-terminal__professor">PROFESSOR</span>
            </dd>
          </div>
          <div className="fl-terminal__row">
            <dt>ENTRY:</dt>
            <dd>ACCEPTED</dd>
          </div>
          <div className="fl-terminal__row fl-terminal__row--critical">
            <dt>EXIT:</dt>
            <dd>
              <span className="fl-terminal__no-record">NO RECORD</span>
            </dd>
          </div>
          <div className="fl-terminal__row">
            <dt>LOCKDOWN INITIATED:</dt>
            <dd>03:17:00</dd>
          </div>
        </dl>

        <div className="fl-terminal__corrupt" aria-hidden="true">
          <p className="fl-terminal__corrupt-line">&gt; RECORD INCOMPLETE</p>
          <p className="fl-terminal__corrupt-line fl-terminal__corrupt-line--fade">
            &gt; FURTHER DATA CORRUPTED
          </p>
        </div>
      </article>

      {TAPE_STRIPS.map((strip) => (
        <TapeMarquee key={strip.id} text={strip.text} className={strip.className} />
      ))}

      <div className="fl-blocker" aria-hidden="true" />
    </div>,
    document.body,
  );
}
