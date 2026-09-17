type CopyWalletIconButtonProps = {
  copied: boolean;
  onCopy: () => void;
};

export default function CopyWalletIconButton({
  copied,
  onCopy,
}: CopyWalletIconButtonProps) {
  return (
    <button
      type="button"
      className={`wl-admin__copy-btn${copied ? " is-copied" : ""}`}
      aria-label={copied ? "Wallet address copied" : "Copy wallet address"}
      title={copied ? "Copied" : "Copy wallet address"}
      onClick={(event) => {
        event.stopPropagation();
        onCopy();
      }}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"
          />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
          />
        </svg>
      )}
    </button>
  );
}
