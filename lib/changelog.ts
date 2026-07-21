// User-facing changelog. Newest version first. Keep entries about *features* and
// how to use them — no code, databases, or internals. The top entry's version
// should match APP_VERSION in lib/version.ts; that entry drives the "what's new"
// popup shown once after each update.

export type ChangelogArt = "presence" | "nudge" | "avatar" | "webtoon" | "spicy";

export interface ChangelogItem {
  title: string;
  body: string;
  /** How to use it, in one plain sentence. */
  how?: string;
  /** Optional preview image (path under /public), preferred over `art`. */
  image?: string;
  /** Optional illustration key (rendered by components/ChangelogArt). */
  art?: ChangelogArt;
}

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  intro?: string;
  /** Marks a big release — shown with a "Major update" badge. */
  major?: boolean;
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2026-07-20",
    title: "Chapter recaps",
    intro: "A quick refresher for every chapter, right where you finish it — perfect for picking a long story back up after a break.",
    items: [
      {
        title: "A recap at the end of every chapter",
        body: "Chapters can now carry a short recap — a paragraph or two summarizing what happened. It appears in a tidy “Chapter recap” panel at the very end of the chapter, collapsed by default, so it never gets in the way of the story. Tap it open whenever you need a memory jog before moving on, or when you're returning after a while away.",
        how: "Read to the end of a chapter and tap “📝 Chapter recap” to expand it.",
        image: "/changelog/recap-reader.png",
      },
      {
        title: "Write recaps right in the editor",
        body: "For admins, every chapter now has a Recap box in the editor — plain Markdown, with a live preview beside it, just like the chapter body. Leave it blank and readers simply won't see a recap panel for that chapter.",
        how: "Open a chapter in the admin editor, scroll to the Recap box, and write a short summary in Markdown.",
        image: "/changelog/recap-editor.png",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-07-20",
    title: "Reading together — with stats and speed",
    major: true,
    intro: "A big update: see who else is reading and react in the moment, give yourself a profile photo, track everyone's reading in a new stats dashboard, and enjoy faster loading.",
    items: [
      {
        title: "See who's online",
        body: "When another reader is in the library at the same time as you, they now show up under “Online now” on your library screen, along with the book and chapter they're on. Inside a book, a small row of reader icons appears at the top — each with a green dot when they're online.",
        how: "Open your library, or a book, and look for the green dots — no setup needed.",
        image: "/changelog/online.png",
      },
      {
        title: "Know when someone's reading the same book",
        body: "If another reader is in the exact same book as you, their icon at the top of the reader gets a green ring and a little number showing which chapter they're on — so you can tell at a glance if a friend is right there with you.",
        how: "Open a book someone else is reading and watch the icons at the top of the page.",
        image: "/changelog/presence-reader.png",
      },
      {
        title: "Bump a friend or send a quick note",
        body: "Tap the reader icons at the top of a book to see who's around. From there you can send a friendly “bump” or a short message. These are just-for-fun, in-the-moment notes — they pop up on the other person's screen for a few seconds and then disappear. Nothing is saved.",
        how: "Tap the reader icons at the top of the reader, then use 👋 to bump or 💬 to send a quick note.",
        image: "/changelog/reader-menu.png",
      },
      {
        title: "Add a profile photo",
        body: "Give yourself a face. Your photo shows up next to your name wherever readers appear — the online list, the “who's reading” list, and beside the reader icons. Photos are automatically cropped to a neat circle and shrunk down, so even a big phone picture uploads quickly.",
        how: "Go to Account → Profile photo → Upload photo.",
        image: "/changelog/avatar.png",
      },
      {
        title: "Choose whether to be seen",
        body: "Prefer to read privately? You can turn off sharing so others can't see when you're online or what you're reading. You'll still see everyone else.",
        how: "Go to Account and turn off “Share my reading activity”.",
        image: "/changelog/privacy.png",
      },
      {
        title: "Reading stats dashboard",
        body: "See how everyone's reading is going. Each reader has a page with their total time, books started and finished, current streak, a “when do you read” chart you can scroll through day by day, and a per-book breakdown showing how long each chapter took.",
        how: "Open Stats from the top menu, then tap any reader.",
        image: "/changelog/stats.png",
      },
      {
        title: "Faster loading, less data used",
        body: "Book covers, artwork and app files are now kept on your device after the first load, so pages open faster and use less data on repeat visits. The reader also gets the next chapter ready in advance, so moving on is instant.",
      },
      {
        title: "Clear cached data",
        body: "If something ever looks out of date or you want to free up space, you can wipe the on-device cache and reload everything fresh.",
        how: "Go to Account → Storage → Clear cached data.",
        image: "/changelog/cache.png",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-19",
    title: "Comics & webtoons",
    items: [
      {
        title: "Read image-based books",
        body: "Books can now be published as vertical, scrolling webtoons — tall image chapters you read top to bottom, just like a comic. They remember where you left off, the same as text books.",
        how: "Open a webtoon book from your library and scroll down through the artwork.",
        art: "webtoon",
      },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-07-17",
    title: "Comfort & content controls",
    items: [
      {
        title: "Spicy-content controls",
        body: "Steamier passages are clearly marked, and — depending on your access — can be revealed with a tap or hidden entirely so a book reads with none of it. The library owner decides what each reader sees.",
        how: "Tap a marked passage to reveal it, if you have access.",
        art: "spicy",
      },
      {
        title: "Snappier page turns",
        body: "Moving between chapters now shows a slim loading bar and instant press feedback, so taps feel responsive even over a slow connection.",
      },
    ],
  },
];

/** The changelog entry for a given version, if any. */
export function changelogFor(version: string): ChangelogEntry | undefined {
  return CHANGELOG.find((e) => e.version === version);
}
