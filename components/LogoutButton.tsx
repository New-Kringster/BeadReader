"use client";
import { logoutAction } from "@/app/actions/auth";

export default function LogoutButton({
  className = "btn btn-sm",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={className} title="Log out" aria-label="Log out">
        {children ?? "Log out"}
      </button>
    </form>
  );
}
