import { listReaders, getReaderActivity } from "@/lib/data";
import { createReaderAction } from "@/app/actions/readers";
import ReaderTable, { type ActivityRow } from "@/components/ReaderTable";
import SubmitButton from "@/components/SubmitButton";

export default async function ReadersPage() {
  const readers = await listReaders();
  const activityLists = await Promise.all(readers.map((r) => getReaderActivity(r.id)));
  const activity: Record<string, ActivityRow[]> = {};
  readers.forEach((r, i) => (activity[r.id] = activityLists[i]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Readers</h1>
        <p className="text-muted text-sm">
          Create a reader, then copy their access code and share it however you like. Toggle “spicy”
          to let a reader see explicit chapters.
        </p>
      </div>

      <section className="card p-6">
        <h2 className="font-semibold mb-3">Add a reader</h2>
        <form action={createReaderAction} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="name" className="label">Name</label>
            <input id="name" name="name" className="field" placeholder="e.g. Sam" required />
          </div>
          <SubmitButton pendingLabel="Creating…">Create &amp; generate code</SubmitButton>
        </form>
      </section>

      <ReaderTable readers={readers} activity={activity} />
    </div>
  );
}
