import { requireAdmin } from "@/lib/auth";
import { listAllUsers, getReaderActivity, getAvatars } from "@/lib/data";
import AddUserForm from "@/components/AddUserForm";
import UsersTable, { type ActivityRow } from "@/components/UsersTable";

export default async function PeoplePage() {
  const me = await requireAdmin();
  const users = await listAllUsers();
  const [activityLists, avatarMap] = await Promise.all([
    Promise.all(users.map((u) => getReaderActivity(u.id))),
    getAvatars(users.map((u) => u.id)),
  ]);
  const activity: Record<string, ActivityRow[]> = {};
  users.forEach((u, i) => (activity[u.id] = activityLists[i]));
  const avatars: Record<string, string> = Object.fromEntries(avatarMap);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">People</h1>
        <p className="text-muted text-sm">
          Create readers or admins, copy their access code to share out-of-band, set or regenerate
          codes, toggle a reader&apos;s “spicy” access, and revoke or delete accounts.
        </p>
      </div>

      <section className="card p-6">
        <h2 className="font-semibold mb-3">Add a person</h2>
        <AddUserForm />
      </section>

      <UsersTable users={users} activity={activity} avatars={avatars} currentUserId={me.id} />
    </div>
  );
}
