import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { prisma } from "@/lib/prisma";
import { initSaasDb } from "@/lib/saas/init";
import { resolveOrgForUser } from "@/lib/saas/portalAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/customer/invoices/[id]/pdf — server-side PDF download for an invoice.
 * Uses jspdf to render a clean PDF without requiring a browser.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initSaasDb().catch(() => {});

  const org = await resolveOrgForUser(user);
  if (!org) return NextResponse.json({ error: "No customer account" }, { status: 403 });

  const invoice = await prisma.invoice.findFirst({
    where: { id, organizationId: org.organizationId },
    include: {
      organization: { select: { businessName: true, legalName: true, country: true } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const paidCents = invoice.payments
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + p.amount, 0);

  // Dynamic import jspdf to keep it server-only
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  let y = 40;

  // Header
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text("HospiOS", 40, y);
  doc.setFontSize(18);
  doc.setTextColor(0);
  y += 30;
  doc.text(`Invoice ${invoice.id.slice(-8).toUpperCase()}`, 40, y);

  // Status badge
  doc.setFontSize(9);
  doc.setTextColor(100);
  y += 16;
  doc.text(`Status: ${invoice.status.replace(/_/g, " ").toUpperCase()}`, 40, y);
  y += 14;
  doc.text(`Issued: ${invoice.createdAt.toISOString().slice(0, 10)}`, 40, y);
  if (invoice.dueAt) {
    y += 14;
    doc.text(`Due: ${invoice.dueAt.toISOString().slice(0, 10)}`, 40, y);
  }

  // Billed to
  y += 30;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text("BILLED TO", 40, y);
  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(invoice.organization.businessName || invoice.organization.legalName, 40, y);
  if (invoice.organization.country) {
    y += 14;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(invoice.organization.country, 40, y);
  }

  // Amount due (right-aligned)
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text("AMOUNT DUE", w - 40, 80, { align: "right" });
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(formatCurrency(Math.max(invoice.amount - paidCents, 0), invoice.currency), w - 40, 98, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`of ${formatCurrency(invoice.amount, invoice.currency)} total`, w - 40, 112, { align: "right" });

  // Line items table
  y = Math.max(y + 30, 140);
  doc.setDrawColor(220);
  doc.line(40, y, w - 40, y);
  y += 16;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text("LINE ITEM", 40, y);
  doc.text("AMOUNT", w - 40, y, { align: "right" });
  y += 16;

  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(invoice.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), 40, y);
  doc.text(formatCurrency(invoice.amount, invoice.currency), w - 40, y, { align: "right" });
  y += 20;

  doc.setDrawColor(220);
  doc.line(40, y, w - 40, y);
  y += 16;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Total", 40, y);
  doc.text(formatCurrency(invoice.amount, invoice.currency), w - 40, y, { align: "right" });
  doc.setFont("helvetica", "normal");

  // Payments
  if (invoice.payments.length > 0) {
    y += 30;
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text("PAYMENTS", 40, y);
    y += 14;
    for (const p of invoice.payments) {
      doc.setFontSize(9);
      doc.setTextColor(60);
      doc.text(`${p.createdAt.toISOString().slice(0, 10)}  ${p.gateway}  ${formatCurrency(p.amount, p.currency)}  (${p.status})`, 40, y);
      y += 14;
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(160);
  doc.text("Questions about this invoice? Open a billing ticket from your customer portal.", 40, doc.internal.pageSize.getHeight() - 40);

  const pdfBytes = doc.output("arraybuffer");
  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.id.slice(-8)}.pdf"`,
    },
  });
}

function formatCurrency(cents: number, currency: string): string {
  const val = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(val);
  } catch {
    return `$${val.toFixed(2)}`;
  }
}
