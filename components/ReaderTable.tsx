"use client";
import { useState } from "react";
import type { User } from "@/lib/types";
import CopyButton from "@/components/CopyButton";
import ActionButton from "@/components/ActionButton";
import { formatDuration, formatDate } from "@/lib/format";
import {
  regenerateCodeAction,
  toggleRevokedAction,
  toggleExplicitAction,
  deleteReaderAction,
} from "@/app/actions/readers";

export interface ActivityRow {
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  updatedAt: string;
  totalSeconds: number;
}

export default function ReaderTable({
  readers,
  activity,
}: {
  readers: User[];
  activity: Record<string, ActivityRow[]>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (readers.length === 0) {
    return <p className="text-muted text-sm">No readers yet. Add one above and share their code.</p>;
  }

  return (
    <div className="grid gap-3">
      {readers.map((r) => {
        const rows = activity[r.id] ?? [];
        const totalTime = rows.reduce((s, a) => s + a.totalSeconds, 0);
        return (
          <div key={r.id} className={`card p-4 ${r.revoked ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.name}</span>
                  {r.has_explicit_access && <span className="badge badge-spicy">🌶 spicy access</span>}
                  {r.revoked && <span className="badge badge-draft">revoked</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-line/60 px-2 py-0.5 rounded tracking-wide">
                    {r.access_code}
                  </code>
                  <CopyButton value={r.access_code} className="btn btn-sm" />
                </div>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <ActionButton
                  action={toggleExplicitAction.bind(null, r.id, !r.has_explicit_access)}
                  className="btn btn-sm"
                  title="Toggle explicit (spicy) access"
                >
                  {r.has_explicit_access ? "Remove spicy" : "Grant spicy"}
                </ActionButton>
                <ActionButton
                  action={toggleRevokedAction.bind(null, r.id, !r.revoked)}
                  className="btn btn-sm"
                >
                  {r.revoked ? "Restore" : "Revoke"}
                </ActionButton>
                <ActionButton
                  action={regenerateCodeAction.bind(null, r.id)}
                  className="btn btn-sm"
                  confirm="Generate a new code? The old one stops working immediately."
                >
                  Regenerate
                </ActionButton>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                >
                  {open === r.id ? "Hide" : "Activity"}
                </button>
                <ActionButton
                  action={deleteReaderAction.bind(null, r.id)}
                  className="btn btn-sm btn-danger"
                  confirm={`Delete ${r.name}? Their progress and reading time are removed too.`}
                >
                  Delete
                </ActionButton>
              </div>
            </div>

            {open === r.id && (
              <div className="mt-4 border-t border-line pt-3 text-sm">
                <div className="text-muted mb-2">
                  Total reading time: <strong>{formatDuration(totalTime)}</strong> · Added{" "}
                  {formatDate(r.created_at)}
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
