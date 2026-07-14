"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );

  return (
    <main className="flex flex-1 items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo size={64} className="mx-auto mb-3" />
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>
            BeadReader
          </h1>
          <p className="text-muted mt-1 text-sm">Enter your access code to start reading.</p>
        </div>

        <form action={formAction} className="card p-6 space-y-4">
          <div>
            <label htmlFor="code" className="label">
              Access code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              className="field text-center tracking-widest text-lg"
            />
          </div>

          {state.error && (
            <p className="text-sm text-center" style={{ color: "var(--danger)" }} role="alert">
              {state.error}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={pending}>
            {pending ? "Checking…" : "Enter"}
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-6">
          No account? Ask the library owner for a code.
        </p>
      </div>
    </main>
  );
}
