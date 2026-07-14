"use client";
import { useActionState, useRef } from "react";
import { createUserAction, type UserFormState } from "@/app/actions/readers";

export default function AddUserForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    async (prev, fd) => {
      const result = await createUserAction(prev, fd);
      if (result.success) formRef.current?.reset();
      return result;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="name" className="label">Name</label>
          <input id="name" name="name" className="field" placeholder="e.g. Sam" required />
        </div>
        <div>
          <label htmlFor="role" className="label">Role</label>
          <select id="role" name="role" className="field" defaultValue="reader">
            <option value="reader">Reader</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="code" className="label">Access code (optional)</label>
        <input
          id="code"
          name="code"
          className="field"
          placeholder="Leave blank to auto-generate"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </button>
        {state.error && (
          <span className="text-sm" style={{ color: "var(--danger)" }} role="alert">
            {state.error}
          </span>
        )}
        {state.success && (
          <span className="text-sm" style={{ color: "#3f9d54" }} role="status">
            {state.success}
          </span>
        )}
      </div>
    </form>
  );
}
