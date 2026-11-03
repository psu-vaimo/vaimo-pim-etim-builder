/**
 * Round open and close button with a chevron, right when closed and down when open. Put it inside an element with the
 * `toggle-trigger` class (the clickable title), which highlights it on hover and keyboard focus.
 */
export function ToggleIcon({ open }: { open: boolean }) {
  return (
    <span className="toggle-icon" data-open={open || undefined} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
