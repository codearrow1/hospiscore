import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import CheckoutStatusClient from "@/components/customer/CheckoutStatusClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Checkout status page — the return URL for hosted checkout. It polls the
 * server-authoritative intent status and NEVER reports "paid" until a verified
 * webhook reconciles the payment. While the webhook is pending it shows
 * "Payment is being verified".
 */
export default async function CheckoutStatusPage({ params }: { params: Promise<{ intentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  const { intentId } = await params;
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <CheckoutStatusClient intentId={intentId} />
    </div>
  );
}
