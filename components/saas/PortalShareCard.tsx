"use client";

/** Client island for portal pages: referral link + copy + QR (Phase 6). */
import { useEffect, useState } from "react";
import { btnGhost } from "@/components/marketing-admin/ui";

export default function PortalShareCard({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((m) => m.toString(link, { type: "svg", margin: 1, width: 128 }))
      .then((s) => { if (alive) setSvg(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the raw link stays selectable on screen
    }
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-mono text-sm break-all">{link}</p>
        <button type="button" onClick={copy} className={btnGhost + " mt-2 !py-1 !text-xs"}>
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        <p className="mt-1.5 text-xs text-zinc-500">Clicks → Leads → Trials → Subscriptions → Commission.</p>
      </div>
      {svg ? (
        <div className="h-32 w-32 shrink-0 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="h-32 w-32 shrink-0 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      )}
    </div>
  );
}
