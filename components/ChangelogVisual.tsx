import type { ChangelogItem } from "@/lib/changelog";
import ChangelogArt from "@/components/ChangelogArt";

/** A preview image if the item has one, otherwise the CSS illustration. */
export default function ChangelogVisual({ item }: { item: ChangelogItem }) {
  if (item.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.image}
        alt=""
        loading="lazy"
        className="w-full rounded-lg border border-line"
      />
    );
  }
  if (item.art) return <ChangelogArt art={item.art} />;
  return null;
}
