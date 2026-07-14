"use client";
import { useTransition } from "react";

/**
 * Button that invokes a (bound) Server Action on click, with optional confirm().
 * Server actions are passed straight in as props — Next serializes the reference.
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
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      title={title}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          await action();
        });
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
