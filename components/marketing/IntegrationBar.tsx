import Link from "next/link";
import Marquee from "@/components/marketing/Marquee";
import { INTEGRATION_GROUPS, TOTAL_INTEGRATIONS } from "@/lib/integrations";

/**
 * Home-page integrations bar: marquee of partner names + compliance badges.
 */
export default function IntegrationBar() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-zinc-500">
        <span className="flex items-center gap-2 font-semibold text-zinc-300">
          <svg className="h-4 w-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" /></svg>
          {TOTAL_INTEGRATIONS}+ connected integrations
        </span>
        <span>PCI DSS compliant</span>
        <span>Google Cloud hosted</span>
        <span>24/7 support</span>
      </div>

      <Marquee duration={48}>
        {INTEGRATION_GROUPS[0].items.slice(0, 12).map((name) => (
          <span
            key={name}
            className="mx-2.5 flex shrink-0 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-indigo-500/50 hover:text-zinc-50"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/70" aria-hidden="true" />
            {name}
          </span>
        ))}
        <Link
          href="/integrations"
          className="mx-2.5 shrink-0 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/20"
        >
          + {TOTAL_INTEGRATIONS - 12} more →
        </Link>
      </Marquee>
    </div>
  );
}
