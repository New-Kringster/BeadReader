import SubmitButton from "@/components/SubmitButton";

export default function WebtoonChapterSetup({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="card p-6 max-w-xl space-y-5">
      <div>
        <label htmlFor="title" className="label">Chapter title</label>
        <input id="title" name="title" className="field" placeholder="Episode 1" required />
      </div>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input type="checkbox" name="is_explicit" className="mt-1" />
        <span>🌶 Hide the entire chapter from readers without explicit access</span>
      </label>
      <input type="hidden" name="status" value="draft" />
      <p className="text-sm text-muted">
        The chapter starts as a draft. On the next screen, upload its ordered image folder and
        publish it when every image is ready.
      </p>
      <SubmitButton>Create draft and add images</SubmitButton>
    </form>
  );
}
