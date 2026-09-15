import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import AdminLogoMark from "../features/whitelist/components/AdminLogoMark";
import { HOME_ASSETS } from "../lib/homeAssets";
import { useAdminAuth } from "../features/whitelist/hooks/useAdminAuth";

export default function AdminLoginPage() {
  const { loading, session, isAdmin, configured, signIn } = useAdminAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from =
    (location.state as { from?: string } | null)?.from ?? "/admin";

  useEffect(() => {
    document.title = "Admin Login — Blackwater Labs";
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("rz2-page-scroll");
    document.body.classList.add("rz2-page-scroll", "wl-admin-active");
    return () => {
      document.documentElement.classList.remove("rz2-page-scroll");
      document.body.classList.remove("rz2-page-scroll", "wl-admin-active");
    };
  }, []);

  if (!configured) {
    return (
      <div className="wl-admin wl-admin--center">
        <p className="wl-admin__error">Supabase is not configured.</p>
        <Link to="/">Return home</Link>
      </div>
    );
  }

  if (!loading && session && isAdmin) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
    } catch {
      setError("Invalid credentials or unauthorised account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wl-admin wl-admin--login">
      <div className="wl-admin__fx" aria-hidden="true">
        <img
          className="wl-admin__atmosphere"
          src={HOME_ASSETS.atmosphere}
          alt=""
          width={1672}
          height={941}
          decoding="async"
        />
        <img
          className="wl-admin__lab"
          src={HOME_ASSETS.labOverlay}
          alt=""
          width={1536}
          height={1024}
          loading="lazy"
          decoding="async"
        />
        <div className="wl-admin__grain" />
        <div className="wl-admin__vignette" />
      </div>

      <form className="wl-admin__login-card" onSubmit={(e) => void onSubmit(e)}>
        <AdminLogoMark variant="login" />
        <p className="wl-admin__login-eyebrow">BLACKWATER LABS</p>
        <h1 className="wl-admin__login-title">Admin Clearance</h1>
        <p className="wl-admin__login-lead">
          Authorised personnel only. All actions are logged.
        </p>

        <label className="wl-admin__field-label" htmlFor="admin-email">
          Email
        </label>
        <input
          id="admin-email"
          className="wl-admin__field-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="wl-admin__field-label" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          className="wl-admin__field-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <p className="wl-admin__login-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="wl-admin__btn wl-admin__btn--primary"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign In"}
        </button>

        <p className="wl-admin__login-back">
          <Link to="/">← Return to site</Link>
        </p>
      </form>
    </div>
  );
}
