"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface VerifySession {
  method: "phone_otp" | "email";
  target: string;
  maskedTarget: string;
  debugCode?: string;
}

export default function ClaimVerifyControl({
  claimId,
  verified,
  verificationMethod,
}: {
  claimId: string;
  verified: boolean;
  verificationMethod: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<VerifySession | null>(null);
  const [method, setMethod] = useState<"phone_otp" | "email">("phone_otp");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (verified) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        Verified{verificationMethod ? ` (${verificationMethod})` : ""}
      </span>
    );
  }

  async function requestOTP() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/customer/claims/${claimId}/verify/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Could not send verification code" });
        return;
      }
      setSession({
        method,
        target,
        maskedTarget: data.maskedTarget,
        debugCode: data.debugCode,
      });
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    if (!session) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/customer/claims/${claimId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: session.method,
          code,
          ...(session.method === "phone_otp" ? { phone: target } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Verification failed" });
        return;
      }
      setMsg({ ok: true, text: "Ownership verified." });
      setSession(null);
      setCode("");
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        Not verified
      </span>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Verify ownership
        </button>
      )}
      {open && (
        <div className="mt-1 flex w-72 flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left dark:border-zinc-700 dark:bg-zinc-800">
          {!session ? (
            <>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "phone_otp" | "email")}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <option value="phone_otp">Phone (OTP)</option>
                <option value="email">Email (OTP)</option>
              </select>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={method === "phone_otp" ? "Your phone number" : "Your email address"}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              />
              <button
                onClick={requestOTP}
                disabled={busy || !target.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {busy ? "Sending…" : "Send code"}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Enter the 6-digit code sent to {session.maskedTarget}
                {session.debugCode ? (
                  <span className="mt-1 block font-mono text-sm text-zinc-800 dark:text-zinc-100">
                    Dev code: {session.debugCode}
                  </span>
                ) : null}
              </p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                maxLength={6}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-center font-mono text-sm tracking-widest dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={submitCode}
                  disabled={busy || code.length !== 6}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  {busy ? "Verifying…" : "Verify"}
                </button>
                <button
                  onClick={() => {
                    setSession(null);
                    setCode("");
                  }}
                  className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200"
                >
                  Back
                </button>
              </div>
            </>
          )}
          {msg && (
            <p className={`text-xs ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
