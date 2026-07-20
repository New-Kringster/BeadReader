"use client";
import { useState } from "react";
import type { DayHours } from "@/lib/data";
import { formatDuration } from "@/lib/format";

function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((t0.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function hourLabel(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

/**
 * When-do-you-read histogram: a 24-bar day view you scroll through one day at a
 * time. `days` is newest-first (as returned by getReaderStats).
 */
export default function HourlyHistogram({ days }: { days: DayHours[] }) {
  const [i, setI] = useState(0);

  if (days.length === 0) {
    return (
      <p className="text-sm text-muted">No reading recorded yet — it starts filling in as you read.</p>
    );
  }

  const day = days[i];
  const max = Math.max(...day.hours, 1);
  const peakHour = day.hours.indexOf(Math.max(...day.hours));

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          className="btn btn-sm"
          disabled={i >= days.length - 1}
          onClick={() => setI((v) => Math.min(days.length - 1, v + 1))}
          aria-label="Previous day"
        >
          ←
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-sm font-medium">{dayLabel(day.day)}</div>
          <div className="text-xs text-muted">
            {formatDuration(day.total)}
            {day.total > 0 && ` · most active ${hourLabel(peakHour)}`}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          disabled={i <= 0}
          onClick={() => setI((v) => Math.max(0, v - 1))}
          aria-label="Next day"
        >
          →
        </button>
      </div>

      <div className="flex h-28 items-end gap-[2px]">
        {day.hours.map((secs, h) => (
          <div
            key={h}
            className="flex-1 rounded-t bg-accent/70"
            style={{ height: `${secs > 0 ? Math.max(4, (secs / max) * 100) : 0}%` }}
            title={`${hourLabel(h)} — ${formatDuration(secs)}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>11p</span>
      </div>

      <p className="mt-2 text-center text-xs text-muted">
        Day {i + 1} of {days.length}
      </p>
    </div>
  );
}
