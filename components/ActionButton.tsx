"use client";
import { useState, useTransition } from "react";

/**
 * Button that invokes a (bound) Server Action on click, with optional confirm().
 * Server actions are passed straight in as props — Next serializes the reference.
 * If the action throws, the message is surfaced inline (and logged) rather than
 * silently swallowed, so a failing mutation never looks like a dead button.
 */
export default function ActionButton({
  action,
  children,
  className = "btn btn-sm",
  confirm,
  title,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        className={className}
        disabled={pending}
        title={title}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            try {
              await action();
            } catch (err) {
              const message = err instanceof Error ? err.message : "Something went wrong.";
              setError(message);
              console.error("ActionButton action failed:", err);
            }
          });
        }}
      >
        {pending ? "…" : children}
      </button>
      {error && (
        <span className="text-xs" style={{ color: "var(--danger)" }} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
