import { useEffect } from "react";
import SiteShell from "../components/site/SiteShell";
import { TEAM_MEMBERS } from "../lib/team";

export default function TeamPage() {
  useEffect(() => {
    document.title = "Team — Blackwater Labs";
  }, []);

  return (
    <SiteShell>
      <section className="bw-site-page">
        <header className="bw-site-page__header">
          <p className="bw-site-page__eyebrow">Blackwater Labs</p>
          <h1 className="bw-site-page__title">Personnel Files</h1>
          <p className="bw-site-page__lead">
            Classified personnel records — profiles pending full declassification.
          </p>
        </header>

        <ul className="bw-team">
          {TEAM_MEMBERS.map((member) => (
            <li key={member.id}>
              <article className="bw-team__card">
                <div className="bw-team__file-header">
                  <span className="bw-team__clearance">{member.clearance}</span>
                  <span className="bw-team__file-id">BW-{member.id.toUpperCase()}</span>
                </div>
                <div className="bw-team__profile">
                  <img
                    className="bw-team__avatar"
                    src={member.image}
                    alt=""
                    width={72}
                    height={72}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="bw-team__info">
                    <h2 className="bw-team__name">{member.displayName}</h2>
                    <p className="bw-team__role">{member.role}</p>
                    <a
                      href={member.xUrl}
                      className="bw-team__x"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {member.xHandle}
                    </a>
                  </div>
                </div>
                {member.bio ? <p className="bw-team__bio">{member.bio}</p> : null}
              </article>
            </li>
          ))}
        </ul>
      </section>
    </SiteShell>
  );
}
