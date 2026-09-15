import { Navigate } from "react-router-dom";

/** Backwards-compatible redirect — old /whitelist links keep working. */
export default function WhitelistCheckerPage() {
  return <Navigate to="/wallet-checker" replace />;
}
