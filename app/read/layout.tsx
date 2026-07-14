import { requireUser } from "@/lib/auth";

// Guards every /read/* route. No visual chrome here so the immersive reading
// view can own the whole screen; browsable pages render their own <ReaderNav/>.
export default async function ReadLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="flex-1 flex flex-col">{children}</div>;
}
