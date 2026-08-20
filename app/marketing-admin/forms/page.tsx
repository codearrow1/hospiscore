import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { getForms } from "@/lib/marketing/forms";
import FormsManager from "@/components/marketing-admin/FormsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FormsPage() {
  const guard = await requireCapability("forms.manage");
  if (!guard.ok) {
    return restrictedPanel("Forms", "You need forms.manage permission to configure forms.");
  }
  await ensureMarketingStore();

  const forms = await getForms();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Forms</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Configure the site forms and auto-replies. Submit endpoints stay the
          same — <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">/api/marketing/forms/[slug]</code>.
        </p>
      </div>
      <FormsManager forms={forms} />
    </div>
  );
}