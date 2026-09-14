import { useEffect, type ReactNode } from "react";
import HomeNav from "../home/HomeNav";
import { HOME_ASSETS } from "../../lib/homeAssets";

interface SiteShellProps {
  children: ReactNode;
  bodyClass?: string;
}

export default function SiteShell({ children, bodyClass = "bw-site-active" }: SiteShellProps) {
  useEffect(() => {
    document.documentElement.classList.add("rz2-page-scroll");
    document.body.classList.add("rz2-page-scroll", bodyClass);

    return () => {
      document.documentElement.classList.remove("rz2-page-scroll");
      document.body.classList.remove("rz2-page-scroll", bodyClass);
    };
  }, [bodyClass]);

  return (
    <div className="bw-site">
      <HomeNav />

      <main className="bw-site__shell">
        <div className="bw-site__fx" aria-hidden="true">
          <img
            className="bw-site__atmosphere"
            src={HOME_ASSETS.atmosphere}
            alt=""
            width={1672}
            height={941}
            decoding="async"
          />
          <img
            className="bw-site__lab"
            src={HOME_ASSETS.labOverlay}
            alt=""
            width={1536}
            height={1024}
            loading="lazy"
            decoding="async"
          />
          <div className="bw-site__grain" />
          <div className="bw-site__vignette" />
        </div>

        {children}
      </main>
    </div>
  );
}
