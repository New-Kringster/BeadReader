"use server";
import { redirect } from "next/navigation";
import { getUserByAccessCode } from "@/lib/data";
import { createSession, destroySession } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter your access code." };

  const user = await getUserByAccessCode(code);
  if (!user || user.revoked) {
    return { error: "That access code isn't valid." };
  }

  await createSession(user.id);
  redirect(user.role === "admin" ? "/admin" : "/read");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
