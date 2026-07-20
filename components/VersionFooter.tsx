import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

/** Version number with a small changelog link beneath it. */
export default function VersionFooter({ className = "" }: { className?: string }) {
  return (
    <div className={`text-center text-xs text-muted ${className}`}>
      <div>v{APP_VERSION}</div>
      <Link
        href="/changelog"
        className="mt-0.5 inline-block text-[11px] underline underline-offset-2 hover:text-accent"
      >
        Changelog
      </Link>
    </div>
  );
}
