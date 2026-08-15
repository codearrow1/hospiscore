import type { Property } from "@/lib/types";
import type { ScoreResult } from "@/lib/types";
import type { ReportData } from "@/lib/report";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Score-report e-mail (server-only).
 *
 * Turns the computed score + text report into a self-contained HTML e-mail
 * with inline styles so it renders in any client. Every dynamic value is
 * escaped.
 */

export interface ReportEmail {
  subject: string;
  html: string;
}

function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pointList(points: { title: string; body: string; score: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map(
      (p) => `
        <tr>
          <td style="padding:6px 0 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-bottom:1px solid #eceef3;">
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;line-height:1.5;">
                  <strong>${esc(p.title)}</strong>
                  <span style="color:#64748b;">&nbsp;&middot;&nbsp;${esc(p.score)}/100</span>
                  <div style="font-size:13px;color:#475569;margin-top:2px;">${esc(p.body)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
    )
    .join("");
}

export function buildReportEmail(params: {
  property: Property;
  result: ScoreResult;
  report: ReportData;
}): ReportEmail {
  const { property, result, report } = params;

  const reportUrl = property.slug.startsWith("place:")
    ? `${SITE_URL}/property/${encodeURIComponent(property.slug)}`
    : `${SITE_URL}/properties/${encodeURIComponent(property.slug)}`;

  const location = [property.city, property.country].filter(Boolean).join(", ");
  const gradeColor = /^#[0-9a-f]{6}$/i.test(result.gradeColor) ? result.gradeColor : "#f59e0b";

  const strengths = report.strengths.slice(0, 3);
  const watchouts = [...report.watchouts, ...report.risks].sort((a, b) => a.score - b.score).slice(0, 3);

  const market = report.market;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f5f7;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f5f7;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e8ee;">
            <tr>
              <td style="background-color:#0f172a;padding:24px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                      ${esc(SITE_NAME)}
                    </td>
                    <td align="right" style="font-size:12px;font-weight:600;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.08em;">
                      Online presence score
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center" style="padding-bottom:24px;">
                      <div style="font-size:16px;font-weight:600;color:#0f172a;">${esc(property.name)}</div>
                      <div style="font-size:13px;color:#64748b;margin-top:4px;">${esc(location)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:8px;">
                      <div style="display:inline-block;width:96px;height:96px;border-radius:50%;background:${gradeColor};color:#ffffff;line-height:96px;font-size:34px;font-weight:800;">
                        ${esc(result.overall)}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:20px;">
                      <div style="font-size:14px;font-weight:700;color:#0f172a;">Grade: ${esc(result.grade)}</div>
                      <div style="font-size:12px;color:#64748b;margin-top:4px;">
                        ${esc(result.totalReviews.toLocaleString("en-US"))} reviews across ${esc(result.platformsCount)} platforms &middot; weighted rating ${esc(result.averageRating)}/100
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 20px;background-color:#f8fafc;border-radius:12px;font-size:14px;color:#334155;line-height:1.6;">
                      ${esc(report.headline)}
                    </td>
                  </tr>

                  ${
                    strengths.length > 0
                      ? `<tr><td style="padding:24px 0 4px 0;font-size:13px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.06em;">Strengths</td></tr>${pointList(strengths)}`
                      : ""
                  }

                  ${
                    watchouts.length > 0
                      ? `<tr><td style="padding:24px 0 4px 0;font-size:13px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.06em;">What to work on</td></tr>${pointList(watchouts)}`
                      : ""
                  }

                  <tr>
                    <td style="padding:24px 0 4px 0;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;">Market context</td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#334155;line-height:1.7;">
                      Compared against ${esc(market.peerCount)} tracked properties (avg ${esc(market.peerAverage)}/100, best ${esc(market.peerBest)}/100), this property is
                      ${esc(market.overallDelta >= 0 ? `${market.overallDelta} points above` : `${Math.abs(market.overallDelta)} points below`)} the market average
                      and ranks roughly #${esc(market.rankPosition + 1)} of ${esc(market.peerCount)}.
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="padding:28px 0 8px 0;">
                      <a href="${esc(reportUrl)}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:12px 28px;border-radius:10px;">
                        View the live report
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:8px;">
                      <a href="${esc(`${SITE_URL}/contact`)}" style="font-size:13px;color:#4f46e5;text-decoration:none;">Book a free HospiOS demo &rarr;</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e6e8ee;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:12px;color:#94a3b8;line-height:1.6;">
                      Sent by ${esc(SITE_NAME)} &middot; The all-in-one hotel PMS.<br/>
                      You received this because you requested the score report for ${esc(property.name)}.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject: `${SITE_NAME} · ${property.name} scores ${result.overall}/100 (${result.grade})`,
    html,
  };
}
