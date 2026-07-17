/**
 * A locked preview of a spicy passage, shown to readers WITHOUT access. Only a
 * short excerpt reaches the client (see `previewSpicy`); it's rendered with the
 * exact same progressive blur + fade as the reveal block, but with a floating
 * "request access" chip instead of a reveal control — this passage can't be
 * opened here.
 *
 * Mirrors SpicyReveal's collapsed structure (body → veil → floating chip) so the
 * two look identical apart from the control. No interactivity, so it renders fine
 * on both server and client.
 */
export default function SpicyPreview({ text }: { text: string }) {
  return (
    <div
      className="spicy-preview"
      role="note"
      aria-label="Spicy passage — request access from an admin to read it"
    >
      <p className="spicy-preview-body" aria-hidden="true">
        {text}
      </p>
      <div className="spicy-preview-veil" aria-hidden="true" />
      <div className="spicy-preview-lock">🔒 Request access to read</div>
    </div>
  );
}
