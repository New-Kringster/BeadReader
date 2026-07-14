"use client";
import { useEffect, useState } from "react";

/** Cycles the app chrome between light and dark, persisted in localStorage.
 *  Default (no stored choice) follows the OS via the CSS media query. */
export default function ThemeToggle({ className = "btn btn-sm" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
    else setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <button type="button" className={className} onClick={toggle} title="Toggle dark mode" aria-label="Toggle dark mode">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
