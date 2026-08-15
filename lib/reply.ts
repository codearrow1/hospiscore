import { CONFIG } from "@/lib/config";
import type { ReviewRecord } from "@/lib/nlp";
import { PLATFORM_NAMES } from "@/lib/types";

/**
 * AI reply-draft generation (server-only).
 *
 * Uses DeepSeek's OpenAI-compatible chat endpoint to turn a guest review into
 * a professional, public-facing reply. When no API key is configured (offline /
 * demo mode) or the call fails, it falls back to a deterministic template so
 * the "close the loop" feature never depends on a network round-trip.
 */

export interface ReplyDraft {
  reply: string;
  /** Where the draft came from, surfaced for honesty. */
  source: "deepseek" | "template";
  status: "ok" | "degraded";
}

const SYSTEM_PROMPT = [
  "You write short, warm, professional replies that UK/EU hotel owners post publicly",
  "to guest reviews.",
  "Rules:",
  "- 2-4 sentences; first-person from the hotel.",
  "- Acknowledge the specific complaint, apologise sincerely, never argue.",
  "- State one concrete action already taken or planned.",
  "- Thank the guest and invite them back.",
  "- No emojis, no marketing fluff, no fabricated claims.",
].join("\n");

function templateReply(
  review: Pick<ReviewRecord, "platform" | "rating">,
  propertyName: string,
): string {
  const platform = PLATFORM_NAMES[review.platform] ?? "the platform";
  const tone = review.rating <= 2
    ? "We're truly sorry that recent experience fell short of the standard we aim for."
    : "We really appreciate you flagging this and thank you for the honest feedback.";

  return [
    `Thank you for taking the time to review ${propertyName} on ${platform}.`,
    tone,
    `Your points have been shared with the ${platform === "Booking.com" || platform === "Hotels.com" ? "management" : "team"} so we can put them right.`,
    `We'd love the chance to welcome you back and give you the stay you deserved.`,
  ].join(" ");
}

/**
 * Generate a reply draft for a single review.
 * Throws only if the caller supplies invalid input; network/config issues
 * degrade to the template rather than erroring out.
 */
export async function replyDraft(
  review: Pick<ReviewRecord, "text" | "platform" | "rating" | "author">,
  propertyName: string,
): Promise<ReplyDraft> {
  const text = review.text.trim();
  if (!text) throw new Error("review text is required");

  const key = CONFIG.deepseekApiKey;

  if (!key) {
    return { reply: templateReply(review, propertyName), source: "template", status: "degraded" };
  }

  const author = review.author ? ` (from ${review.author})` : "";
  const platform = PLATFORM_NAMES[review.platform] ?? "an online platform";
  const userPrompt = [
    `A guest${author} left this ${review.rating}-star review on ${platform}:`,
    `"""${text}"""`,
    `Draft a reply to this review for the hotel "${propertyName}".`,
  ].join("\n");

  try {
    const res = await fetch(`${CONFIG.deepseekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: CONFIG.deepseekModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 220,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`DeepSeek reply failed (${res.status}): ${body.slice(0, 300)}`);
      return { reply: templateReply(review, propertyName), source: "template", status: "degraded" };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const draft = data.choices?.[0]?.message?.content?.trim();

    if (!draft) {
      return { reply: templateReply(review, propertyName), source: "template", status: "degraded" };
    }
    return { reply: draft, source: "deepseek", status: "ok" };
  } catch (err) {
    console.error("DeepSeek reply error:", err);
    return { reply: templateReply(review, propertyName), source: "template", status: "degraded" };
  }
}