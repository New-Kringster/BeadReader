"use client";
import { logoutAction } from "@/app/actions/auth";

export default function LogoutButton({ className = "btn btn-sm" }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={className}>
        Log out
      </button>
    </form>
  );
}
