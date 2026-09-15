import {
  formatXHandleDisplay,
  xProfileUrl,
} from "../lib/xHandle";

type XHandleLinkProps = {
  handle: string;
  className?: string;
};

export default function XHandleLink({ handle, className = "" }: XHandleLinkProps) {
  const url = xProfileUrl(handle);
  const display = formatXHandleDisplay(handle) || handle;
  const classes = ["wl-admin__x-link", className].filter(Boolean).join(" ");

  if (!url) {
    return <span className={className}>{display}</span>;
  }

  return (
    <a
      href={url}
      className={classes}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
    >
      {display}
    </a>
  );
}
