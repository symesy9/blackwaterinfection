import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import HomeNav from "../components/home/HomeNav";
import { HOME_ASSETS } from "../lib/homeAssets";
import { HOME_PROJECT } from "../lib/homeProjectInfo";

export default function HomePage() {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = "Blackwater Labs — Infection Z-26";
    document.documentElement.classList.add("rz2-page-scroll");
    document.body.classList.add("rz2-page-scroll", "bw-home-active");

    return () => {
      document.documentElement.classList.remove("rz2-page-scroll");
      document.body.classList.remove("rz2-page-scroll", "bw-home-active");
    };
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    let raf = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        hero.style.setProperty("--bw-parallax-x", String(x * 12));
        hero.style.setProperty("--bw-parallax-y", String(y * 8));
      });
    };

    hero.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      hero.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="bw-home">
      <HomeNav />

      <main className="bw-home__shell">
        <section className="bw-home__hero" ref={heroRef} aria-labelledby="bw-home-project-title">
          <div className="bw-home__artboard">
            <div className="bw-home__fx" aria-hidden="true">
              <div className="bw-home__fx-grain" />
              <div className="bw-home__fx-vignette" />
            </div>

            <img
              className="bw-home__layer bw-home__layer--atmosphere"
              src={HOME_ASSETS.atmosphere}
              alt=""
              width={1672}
              height={941}
              decoding="async"
              fetchPriority="high"
            />
            <img
              className="bw-home__layer bw-home__layer--lab"
              src={HOME_ASSETS.labOverlay}
              alt=""
              width={1536}
              height={1024}
              loading="lazy"
              decoding="async"
            />

            <div className="bw-home__wordmark-wrap" aria-hidden="true">
              <img
                className="bw-home__layer bw-home__layer--wordmark"
                src={HOME_ASSETS.wordmark}
                alt=""
                width={2181}
                height={721}
                decoding="async"
                fetchPriority="high"
              />
            </div>

            <div className="bw-home__hero-window" aria-hidden="true">
              <picture>
                <source srcSet={HOME_ASSETS.fullHeroWebp} type="image/webp" />
                <img
                  className="bw-home__layer bw-home__layer--master"
                  src={HOME_ASSETS.fullHero}
                  alt=""
                  width={1536}
                  height={1024}
                  decoding="async"
                  fetchPriority="high"
                />
              </picture>
            </div>

            <div className="bw-home__bottom-fade" aria-hidden="true" />
          </div>

          <aside className="bw-home__panel">
            <div className="bw-home__copy">
              <p className="bw-home__eyebrow">Blackwater Labs</p>
              <h1 id="bw-home-project-title" className="bw-home__project-label">
                Project:
              </h1>
              <p className="bw-home__project-name">
                <span className="bw-home__project-name-stack">
                  <span className="bw-home__project-name-etch" aria-hidden="true">
                    INFECTIO<span>N</span> Z-26
                  </span>
                  <span className="bw-home__project-name-text">
                    <span className="bw-home__project-name-light">INFECTIO</span>
                    <span className="bw-home__name-accent">N</span>
                    <span className="bw-home__project-name-light"> Z-26</span>
                  </span>
                </span>
              </p>
              <p className="bw-home__tagline">{HOME_PROJECT.tagline}</p>

              <dl className="bw-home__meta">
                <div>
                  <dt>Mint date</dt>
                  <dd>{HOME_PROJECT.mintDate}</dd>
                </div>
                <div>
                  <dt>Mint price</dt>
                  <dd>{HOME_PROJECT.mintPrice}</dd>
                </div>
                <div>
                  <dt>Supply</dt>
                  <dd>{HOME_PROJECT.supply}</dd>
                </div>
                <div>
                  <dt>Chain</dt>
                  <dd>{HOME_PROJECT.chain}</dd>
                </div>
              </dl>
            </div>

            <div className="bw-home__actions">
              <Link to="/fcfs" className="bw-home__cta">
                Apply for FCFS →
              </Link>
              <Link to="/infection" className="bw-home__cta bw-home__cta--ghost">
                Infect Me
              </Link>
            </div>
          </aside>
        </section>
      </main>

      <svg className="bw-home__svg-filters" aria-hidden="true" focusable="false">
        <defs>
          <filter
            id="bw-project-grunge"
            x="-8%"
            y="-8%"
            width="116%"
            height="116%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="3"
              seed="12"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="1.2"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
