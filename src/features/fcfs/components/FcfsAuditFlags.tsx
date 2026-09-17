import { auditFlagLabel } from "../lib/audit";
import type { FcfsAuditFlag } from "../lib/types";

export default function FcfsAuditFlags({ flags }: { flags: FcfsAuditFlag[] }) {
  if (flags.length === 0) return null;

  return (
    <ul className="wl-admin__audit-flags">
      {flags.map((flag) => (
        <li key={flag}>
          <span className="wl-admin__badge wl-admin__badge--warn">
            {auditFlagLabel(flag)}
          </span>
        </li>
      ))}
    </ul>
  );
}
