"use client";
import { useActionState } from "react";
import CopyButton from "@/components/CopyButton";
import ActionButton from "@/components/ActionButton";
import { setMyCodeAction, regenerateMyCodeAction, type CodeState } from "@/app/actions/account";

export default function ChangeCodeCard({ currentCode }: { currentCode: string }) {
  const [state, formAction, pending] = useActionState<CodeState, FormData>(setMyCodeAction, {});

  return (
    <div className="card p-6 space-y-5 max-w-md">
      <div>
        <div className="label">Your access code</div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-sm bg-line/60 px-2 py-1 rounded tracking-wide">{currentCode}</code>
          <CopyButton value={currentCode} className="btn btn-sm" />
        </div>
        <p className="text-xs text-muted mt-2">
          This is how you sign in. Changing it keeps you logged in on this device; you&apos;ll use
          the new code next time.
        </p>
      </div>

      <form action={formAction} className="space-y-2">
        <label htmlFor="code" className="label">Set a new code</label>
        <div className="flex gap-2">
          <input
            id="code"
            name="code"
            className="field"
            placeholder="Choose a memorable code"
            autoComplete="off"
            spellCheck={false}
            minLength={4}
            maxLength={40}
            required
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        {state.error && (
          <p className="text-sm" style={{ color: "var(--danger)" }} role="alert">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="text-sm" style={{ color: "#3f9d54" }} role="status">
            {state.success}
          </p>
        )}
      </form>

      <div className="pt-1 border-t border-line">
        <p className="text-xs text-muted mt-3 mb-2">Prefer a random one?</p>
        <ActionButton
          action={regenerateMyCodeAction}
          className="btn btn-sm"
          confirm="Generate a new random code? Your old code stops working immediately."
        >
          Generate random code
        </ActionButton>
      </div>
    </div>
  );
}
