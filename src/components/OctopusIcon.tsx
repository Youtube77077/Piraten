/** Simple original octopus glyph (head, eyes, four curling tentacles). */
export function OctopusIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`octo-icon ${className}`} viewBox="0 0 32 32" aria-hidden="true">
      <path
        className="octo-icon__body"
        d="M16 3.5c-5.4 0-9 3.9-9 9 0 2.6 1 4.6 2.4 6-.9 1.6-2.4 3.4-4.6 4.4 2.6.5 4.9-.6 6.3-1.9-.1 2.4-1.2 4.6-2.6 6 2.9-.4 4.8-2.6 5.6-4.9.6 2.2 1.2 4.1 1.9 5.6.7-1.5 1.3-3.4 1.9-5.6.8 2.3 2.7 4.5 5.6 4.9-1.4-1.4-2.5-3.6-2.6-6 1.4 1.3 3.7 2.4 6.3 1.9-2.2-1-3.7-2.8-4.6-4.4 1.4-1.4 2.4-3.4 2.4-6 0-5.1-3.6-9-9-9z"
      />
      <circle className="octo-icon__eye" cx="12.6" cy="12.6" r="1.7" />
      <circle className="octo-icon__eye" cx="19.4" cy="12.6" r="1.7" />
    </svg>
  );
}
