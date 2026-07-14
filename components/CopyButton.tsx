"use client";
import { useState } from "react";

export default function CopyButton({
  value,
  className = "btn btn-sm",
  label = "Copy",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copy this code:", value);
        }
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
