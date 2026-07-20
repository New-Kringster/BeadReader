import { requireUser } from "@/lib/auth";
import PresenceProvider from "@/components/PresenceProvider";
import NudgeToaster from "@/components/NudgeToaster";

// Guards every /read/* route. No visual chrome here so the immersive reading
// view can own the whole screen; browsable pages render their own <ReaderNav/>.
// The presence provider drives one app-wide poll (readers only) that feeds the
// online indicators and delivers ephemeral nudges to the toaster.
export default async function ReadLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex-1 flex flex-col">
      <PresenceProvider enabled={user.role === "reader"}>
        {children}
        <NudgeToaster />
      </PresenceProvider>
    </div>
  );
}
