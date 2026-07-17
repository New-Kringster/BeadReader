"use client";
import { useActionState, useState } from "react";
import type { User } from "@/lib/types";
import CopyButton from "@/components/CopyButton";
import ActionButton from "@/components/ActionButton";
import { formatDuration, formatDate } from "@/lib/format";
import {
  regenerateCodeAction,
  toggleRevokedAction,
  toggleExplicitAction,
  toggleCalModeAction,
  deleteUserAction,
  setUserCodeAction,
  type UserFormState,
} from "@/app/actions/readers";

export interface ActivityRow {
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  updatedAt: string;
  totalSeconds: number;
}

function SetCodeForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    async (prev, fd) => {
      const result = await setUserCodeAction(userId, prev, fd);
      if (result.success) onDone();
      return result;
    },
    {}
  );
  return (
    <form action={formAction} className="mt-3 border-t border-line pt-3">
      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="label">Set a specific code</label>
          <input
            name="code"
            className="field"
            placeholder="New access code"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? "Saving…" : "Save code"}
        </button>
        <button type="button" className="btn btn-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
      {state.error && (
        <p className="text-sm mt-1" style={{ color: "var(--danger)" }} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

export default function UsersTable({
  users,
  activity,
  currentUserId,
}: {
  users: User[];
  activity: Record<string, ActivityRow[]>;
  currentUserId: string;
}) {
  const [openActivity, setOpenActivity] = useState<string | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);

  if (users.length === 0) {
    return <p className="text-muted text-sm">No accounts yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {users.map((u) => {
        const rows = activity[u.id] ?? [];
        const totalTime = rows.reduce((s, a) => s + a.totalSeconds, 0);
        const isSelf = u.id === currentUserId;
        const isAdmin = u.role === "admin";
        return (
          <div key={u.id} className={`card p-4 ${u.revoked ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{u.name}</span>
                  <span className={`badge ${isAdmin ? "badge-published" : "badge-draft"}`}>
                    {u.role}
                  </span>
                  {isSelf && <span className="badge badge-draft">you</span>}
                  {!isAdmin && u.has_explicit_access && (
                    <span className="badge badge-spicy">🌶 spicy access</span>
                  )}
                  {!isAdmin && u.cal_mode && (
                    <span className="badge badge-draft">🧊 cal mode</span>
                  )}
                  {u.revoked && <span className="badge badge-draft">revoked</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-line/60 px-2 py-0.5 rounded tracking-wide">
                    {u.access_code}
                  </code>
                  <CopyButton value={u.access_code} className="btn btn-sm" />
                </div>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {!isAdmin && (
                  <ActionButton
                    action={toggleExplicitAction.bind(null, u.id, !u.has_explicit_access)}
                    className="btn btn-sm"
                    title="Toggle explicit (spicy) access"
                  >
                    {u.has_explicit_access ? "Remove spicy" : "Grant spicy"}
                  </ActionButton>
                )}
                {!isAdmin && (
                  <ActionButton
                    action={toggleCalModeAction.bind(null, u.id, !u.cal_mode)}
                    className="btn btn-sm"
                    title="Cal mode: hide all spicy content as if it doesn't exist"
                  >
                    {u.cal_mode ? "Unset cal mode" : "Set cal mode"}
                  </ActionButton>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setOpenCode(openCode === u.id ? null : u.id)}
                >
                  Set code
                </button>
                <ActionButton
                  action={regenerateCodeAction.bind(null, u.id)}
                  className="btn btn-sm"
                  confirm="Generate a new random code? The old one stops working immediately."
                >
                  Regenerate
                </ActionButton>
                {!isSelf && (
                  <ActionButton
                    action={toggleRevokedAction.bind(null, u.id, !u.revoked)}
                    className="btn btn-sm"
                  >
                    {u.revoked ? "Restore" : "Revoke"}
                  </ActionButton>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setOpenActivity(openActivity === u.id ? null : u.id)}
                >
                  Activity
                </button>
                {!isSelf && (
                  <ActionButton
                    action={deleteUserAction.bind(null, u.id)}
                    className="btn btn-sm btn-danger"
                    confirm={`Delete ${u.name}? Their progress, comments and reading time go too.`}
                  >
                    Delete
                  </ActionButton>
                )}
              </div>
            </div>

            {openCode === u.id && <SetCodeForm userId={u.id} onDone={() => setOpenCode(null)} />}

            {openActivity === u.id && (
              <div className="mt-4 border-t border-line pt-3 text-sm">
                <div className="text-muted mb-2">
                  Total reading time: <strong>{formatDuration(totalTime)}</strong> · Added{" "}
                  {formatDate(u.created_at)}
                </div>
                {rows.length === 0 ? (
                  <p className="text-muted">Hasn&apos;t started reading yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {rows.map((a) => (
                      <li key={a.bookId} className="flex flex-wrap gap-x-2">
                        <span className="font-medium">{a.bookTitle}</span>
                        <span className="text-muted">— on “{a.chapterTitle}”</span>
                        <span className="text-muted">· {formatDuration(a.totalSeconds)}</span>
                        <span className="text-muted">· {formatDate(a.updatedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
