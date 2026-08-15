import { describe, it, expect } from "vitest";
import { replyDraft } from "./reply";
// Ensure the offline path doesn't touch env. DeepSeek config reads
// process.env at module load; delete to force template mode.
describe("replyDraft (offline)", () => {
  it("returns a template reply when no API key is set", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const draft = await replyDraft(
      { text: "Rude staff, room was dirty", platform: "booking", rating: 1, author: "Tom" },
      "Harbor Lights Inn",
    );
    expect(draft.source).toBe("template");
    expect(draft.status).toBe("degraded");
    expect(draft.reply).toContain("Harbor Lights Inn");
    expect(draft.reply).toContain("Booking.com");
  });

  it("throws for empty review text", async () => {
    await expect(replyDraft({ text: "  ", platform: "booking", rating: 2 }, "X")).rejects.toThrow(
      "review text is required",
    );
  });
});