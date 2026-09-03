import type { ScoreComponent } from "@/lib/types";
import ScoreRadar from "@/components/ScoreRadar";
import TiltCard from "@/components/marketing/TiltCard";

/**
 * Product deep-dive rows (the follow-on feature rows beneath the score offer).
 * Static sample data so the marketing page renders without fetching anything.
 * The primary "One score" offer now lives in ScoreIntelligence.
 */

const SAMPLE_COMPONENTS: ScoreComponent[] = [
  { key: "ratingQuality", label: "Rating quality", score: 86, weight: 0.22, detail: "" },
  { key: "reviewVolume", label: "Review volume", score: 92, weight: 0.13, detail: "" },
  { key: "reviewVelocity", label: "Review velocity", score: 78, weight: 0.08, detail: "" },
  { key: "responseRate", label: "Response rate", score: 71, weight: 0.06, detail: "" },
  { key: "platformDiversity", label: "Platform diversity", score: 83, weight: 0.05, detail: "" },
  { key: "guestExperience", label: "Guest experience", score: 76, weight: 0.16, detail: "" },
  { key: "presence", label: "Online presence", score: 88, weight: 0.08, detail: "" },
  { key: "amenities", label: "Amenities", score: 79, weight: 0.05, detail: "" },
  { key: "visualContent", label: "Visual content", score: 84, weight: 0.05, detail: "" },
  { key: "sustainability", label: "Sustainability", score: 66, weight: 0.04, detail: "" },
  { key: "accessibility", label: "Accessibility", score: 58, weight: 0.03, detail: "" },
  { key: "directBookings", label: "Direct bookings", score: 73, weight: 0.03, detail: "" },
  { key: "brandTrust", label: "Brand trust", score: 81, weight: 0.02, detail: "" },
];

const ROWS = [
  {
    eyebrow: "Reviews, understood",
    title: "Read the signal behind every review",
    body: "Our analyzer classifies review text into the aspects that matter — service, cleanliness, value, location, facilities — and turns real guest language into the experience dimensions that drive your score. No more guessing which complaint to fix first.",
    bullets: ["Per-aspect sentiment from free-text reviews", "Positive vs negative trends at a glance", "Drives smarter, faster owner decisions"],
    visual: "radar",
  },
  {
    eyebrow: "Close the loop",
    title: "Reply to every review with AI drafts",
    body: "Turn negative reviews into opportunities. HospiOS drafts a warm, professional reply for each low rating — acknowledge, apologize, commit to a fix, invite them back. Copy it, adjust it, post it.",
    bullets: ["Draft on any negative review in one click", "DeepSeek-powered, with offline fallback", "Tone that matches your brand voice"],
    visual: "feed",
  },
];

export default function Showcase() {
  return (
    <div className="flex flex-col gap-20">
      {ROWS.map((row) => (
        <div
          key={row.title}
          className="grid items-center gap-10 lg:grid-cols-2"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
              {row.eyebrow}
            </p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
              {row.title}
            </h3>
            <p className="mt-3 text-base leading-relaxed text-zinc-400">
              {row.body}
            </p>
            <ul className="mt-5 flex flex-col gap-2">
              {row.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-zinc-300">
                  <svg className="h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <TiltCard className="glow-border group/visual flex items-center justify-center rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 transition duration-500 hover:shadow-2xl hover:shadow-indigo-950/40">
            <div className="tilt-inner transition-transform duration-500 group-hover/visual:scale-[1.04]">
              {row.visual === "radar" && <ScoreRadar components={SAMPLE_COMPONENTS} size={300} />}
            {row.visual === "feed" && (
              <div className="w-full max-w-sm space-y-3">
                {[
                  { tone: "negative", title: "Rude staff and the room was filthy", chip: "Staff & service", chip2: "Cleanliness" },
                  { tone: "positive", title: "Immaculate rooms, friendly staff — will be back!", chip: "Staff & service", chip2: "Cleanliness" },
                  { tone: "negative", title: "Overpriced for what you get", chip: "Value for money" },
                ].map((r, i) => (
                  <div key={i} className={`rounded-xl border p-3 ${r.tone === "negative" ? "border-rose-900/60 bg-rose-950/30" : "border-emerald-900/60 bg-emerald-950/30"}`}>
                    <div className="mb-1 text-xs font-medium text-zinc-400">
                      Booking.com <span className="text-amber-400">{"★".repeat(r.tone === "negative" ? 2 : 5)}</span>
                    </div>
                    <p className="text-sm text-zinc-200">“{r.title}”</p>
                    <div className="mt-2 flex gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.tone === "negative" ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                        {r.chip}
                      </span>
                      {r.chip2 && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.tone === "negative" ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                          {r.chip2}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </TiltCard>
        </div>
      ))}
    </div>
  );
}