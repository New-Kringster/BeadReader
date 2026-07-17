/**
 * A slim indeterminate loading bar pinned to the top of the viewport, shown while
 * a navigation is in flight so a click feels acknowledged even though the next
 * page takes a server round-trip. Pure CSS animation (no state), theme-aware via
 * currentColor — it inherits the reader's text colour where it's mounted.
 */
export default function NavProgress({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="nav-progress" role="progressbar" aria-label="Loading" aria-busy="true">
      <span className="nav-progress-bar" />
    </div>
  );
}
