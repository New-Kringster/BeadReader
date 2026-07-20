"use client";
import { useState, useTransition } from "react";
import { setShareActivityAction } from "@/app/actions/account";

/**
 * Reader opt-in/out of the social layer (presence + stats). Optimistic: flips
 * immediately, reverts if the server action fails.
 */
export default function ShareActivityToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      try {
        await setShareActivityAction(next);
      } catch {
        setOn(!next); // revert
      }
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      disabled={pending}
      className="flex w-full items-center justify-between gap-4 text-left disabled:opacity-60"
    >
      <span>
        <span className="font-medium">Share my reading activity</span>
        <span className="mt-0.5 block text-xs text-muted">
          {on
            ? "Other readers can see when you're online and your reading stats."
            : "You're hidden from presence and stats — you can still see others."}
        </span>
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? "bg-accent" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
            on ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
