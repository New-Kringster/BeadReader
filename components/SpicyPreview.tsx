/**
 * A locked preview of a spicy passage, shown to readers WITHOUT access. Only a
 * short plain-text excerpt reaches the client (see `previewSpicy`); it's rendered
 * blurred and fading, with a note that access must be requested from an admin.
 * There is no reveal control — this passage can't be opened here.
 *
 * No interactivity, so this renders fine on both server and client.
 */
export default function SpicyPreview({ text }: { text: string }) {
  return (
    <div
      className="spicy-preview"
      role="note"
      aria-label="Spicy passage — request access from an admin to read it"
    >
      <div className="spicy-preview-clip">
        <p className="spicy-preview-body" aria-hidden="true">
          {text}
        </p>
        <div className="spicy-preview-veil" aria-hidden="true" />
      </div>
      <div className="spicy-preview-lock">🔒 Spicy passage — ask an admin for access</div>
    </div>
  );
}
