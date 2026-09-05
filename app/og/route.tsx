import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 } as const;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const headline = truncate(searchParams.get("title")?.trim() || SITE_NAME, 80);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 15% 10%, rgba(99,102,241,0.55) 0%, transparent 45%), radial-gradient(circle at 85% 90%, rgba(139,92,246,0.5) 0%, transparent 45%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "72px",
              height: "72px",
              borderRadius: "18px",
              background: "#4f46e5",
              color: "#ffffff",
              fontSize: "40px",
              fontWeight: 800,
            }}
          >
            H
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: "52px",
                fontWeight: 800,
                color: "#fafafa",
                letterSpacing: "-0.5px",
              }}
            >
              {SITE_NAME}
            </div>
            <div style={{ fontSize: "24px", color: "#a1a1aa", fontWeight: 500 }}>
              {SITE_TAGLINE}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            maxWidth: "1000px",
            fontSize: "64px",
            fontWeight: 700,
            lineHeight: 1.15,
            textAlign: "center",
            color: "#fafafa",
            letterSpacing: "-1px",
          }}
        >
          {headline}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginTop: "48px",
            padding: "12px 28px",
            borderRadius: "9999px",
            background: "rgba(99,102,241,0.18)",
            border: "1px solid rgba(129,140,248,0.4)",
            fontSize: "26px",
            color: "#c7d2fe",
            fontWeight: 600,
          }}
        >
          <span style={{ width: "14px", height: "14px", borderRadius: 9999, background: "#34d399" }} />
          23 modules · 14+ OTA channels · 10 property types
        </div>
      </div>
    ),
    { ...SIZE }
  );
}
