"use client";
import { useEffect } from "react";
import { useNudges } from "@/components/PresenceProvider";
import type { IncomingNudge } from "@/lib/types";

// How long each kind of nudge lingers before it fades away. Nudges are
// ephemeral — once dismissed they're gone (nothing is stored).
const DURATION: Record<IncomingNudge["kind"], number> = { bump: 5000, text: 8000 };

function Toast({ nudge, onDone }: { nudge: IncomingNudge; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, DURATION[nudge.kind]);
    return () => clearTimeout(t);
  }, [nudge.kind, onDone]);

  return (
    <button
      type="button"
      onClick={onDone}
      className="pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border border-line bg-panel px-3.5 py-2.5 text-left shadow-lg animate-[nudge-in_0.2s_ease-out]"
    >
      <span aria-hidden className="text-lg leading-none">
        {nudge.kind === "bump" ? "👋" : "💬"}
      </span>
      <span className="min-w-0">
        {nudge.kind === "bump" ? (
          <span className="text-sm">
            <span className="font-semibold">{nudge.fromName}</span> bumped you
          </span>
        ) : (
          <span className="text-sm">
            <span className="font-semibold">{nudge.fromName}</span>
            <span className="mt-0.5 block break-words text-muted">{nudge.body}</span>
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * App-wide ephemeral nudge toasts. Mounted once in the /read layout; consumes
 * nudges delivered through the single presence poll. Sits above the immersive
 * reader (z-50).
 */
export default function NudgeToaster() {
  const { nudges, dismissNudge } = useNudges();
  if (nudges.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto flex w-[min(22rem,calc(100%-1.5rem))] flex-col gap-2">
      {nudges.map((n) => (
        <Toast key={n.id} nudge={n} onDone={() => dismissNudge(n.id)} />
      ))}
    </div>
  );
}
