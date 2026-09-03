import { describe, it, expect, beforeEach } from "vitest";
import {
  __setPortalStore,
  bindPortalIdentity,
  getPortalBinding,
  unbindPortalIdentity,
  createPortalClaimToken,
  peekPortalClaimToken,
  consumePortalClaimToken,
  hashToken,
  isClaimExpired,
  isPortalKind,
  findOrgContactForUser,
  CLAIM_TTL_MS,
  BINDINGS_KEY,
  CLAIMS_KEY,
  type PortalBinding,
  type PortalClaimRecord,
} from "./portalLinks";

/** In-memory KV store mirroring the SystemSetting shape. */
function memoryStore() {
  const kv = new Map<string, unknown>();
  return {
    kv,
    async read(key: string) {
      return kv.get(key) ?? {};
    },
    async write(key: string, value: unknown) {
      kv.set(key, value);
    },
  };
}

let store: ReturnType<typeof memoryStore>;
beforeEach(() => {
  store = memoryStore();
  __setPortalStore(store);
});

describe("portalLinks kind guard", () => {
  it("accepts only the three sanctioned portal kinds", () => {
    expect(isPortalKind("affiliate")).toBe(true);
    expect(isPortalKind("partner")).toBe(true);
    expect(isPortalKind("org_contact")).toBe(true);
    expect(isPortalKind("user")).toBe(false);
    expect(isPortalKind("")).toBe(false);
    expect(isPortalKind(null)).toBe(false);
  });
});

describe("portalLinks bindings", () => {
  it("binds, reads and unbinds a portal identity", async () => {
    const b = await bindPortalIdentity({ kind: "org_contact", refId: "ct_1", userId: "u1", boundBy: "admin@x" });
    expect(b).toMatchObject({ kind: "org_contact", refId: "ct_1" });
    expect(await getPortalBinding("u1")).toEqual(b);
    expect(await getPortalBinding("nobody")).toBeNull();

    // Rebinding overwrites (admin recovery path).
    const b2 = await bindPortalIdentity({ kind: "partner", refId: "pt_9", userId: "u1", boundBy: "admin@x" });
    expect((await getPortalBinding("u1"))?.refId).toBe("pt_9");
    expect(b2.kind).toBe("partner");

    expect(await unbindPortalIdentity("u1")).toBe(true);
    expect(await getPortalBinding("u1")).toBeNull();
    expect(await unbindPortalIdentity("u1")).toBe(false);
  });

  it("keys bindings per user — one binding never leaks to another account", async () => {
    await bindPortalIdentity({ kind: "affiliate", refId: "af_1", userId: "victim", boundBy: "admin@x" });
    expect(await getPortalBinding("attacker")).toBeNull();
    const raw = store.kv.get(BINDINGS_KEY) as Record<string, PortalBinding>;
    expect(Object.keys(raw)).toEqual(["victim"]);
  });

  it("S-01: org-contact resolution is binding-only — no raw email match leaks an org", async () => {
    // An unbound account never resolves to an org contact. Under the old
    // implementation this fell back to a raw email match, so an attacker who
    // registered an email equal to a public OrgContact email inherited that
    // customer's org scope while having authored zero bindings.
    expect(await findOrgContactForUser("attacker_with_matching_email")).toBeNull();

    // A non-org_contact (e.g. affiliate) binding must NOT grant customer scope.
    await bindPortalIdentity({ kind: "affiliate", refId: "af_2", userId: "u_aff", boundBy: "admin@x" });
    expect(await findOrgContactForUser("u_aff")).toBeNull();

    // Only an explicit org_contact binding unlocks resolution.
    await bindPortalIdentity({ kind: "org_contact", refId: "ct_9", userId: "u_ok", boundBy: "admin@x" });
    expect(await getPortalBinding("u_ok")).toMatchObject({ kind: "org_contact", refId: "ct_9" });
  });
});

describe("portalLinks claim tokens", () => {
  it("hashes tokens with sha256 and never stores plaintext", async () => {
    const { token } = await createPortalClaimToken({ kind: "affiliate", refId: "af_1", createdBy: "admin@x" });
    const raw = store.kv.get(CLAIMS_KEY) as Record<string, PortalClaimRecord>;
    expect(Object.keys(raw)).toEqual([hashToken(token)]);
    expect(JSON.stringify(raw)).not.toContain(token);
  });

  it("peek validates without burning; consume burns exactly once", async () => {
    const { token } = await createPortalClaimToken({ kind: "partner", refId: "pt_1", createdBy: "admin@x" });

    expect(await peekPortalClaimToken(token)).not.toBeNull();
    expect(await peekPortalClaimToken(token)).not.toBeNull(); // still there
    expect(Object.keys(store.kv.get(CLAIMS_KEY) as object)).toHaveLength(1);

    await consumePortalClaimToken({ token, userId: "u2", boundBy: "u2@x" });
    expect(await peekPortalClaimToken(token)).toBeNull();

    await expect(consumePortalClaimToken({ token, userId: "u3", boundBy: "u3@x" })).rejects.toThrow(/Invalid or expired/);
    // The replay attempt must not create a second binding.
    expect(await getPortalBinding("u3")).toBeNull();
  });

  it("rejects unknown and expired tokens", async () => {
    await expect(consumePortalClaimToken({ token: "nope", userId: "u4", boundBy: "x" })).rejects.toThrow(/Invalid or expired/);
    expect(isClaimExpired({ expiresAt: new Date(Date.now() - 1).toISOString() })).toBe(true);
    expect(isClaimExpired({ expiresAt: new Date(Date.now() + CLAIM_TTL_MS).toISOString() })).toBe(false);
    expect(isClaimExpired({ expiresAt: "garbage" })).toBe(true);
  });

  it("sweeps stale claims on mint so the map cannot grow forever", async () => {
    const stale = {
      [hashToken("old-token")]: { kind: "affiliate", refId: "af_old", expiresAt: new Date(Date.now() - 1000).toISOString(), createdBy: "admin@x" },
    };
    store.kv.set(CLAIMS_KEY, stale);
    await createPortalClaimToken({ kind: "affiliate", refId: "af_1", createdBy: "admin@x" });
    const raw = store.kv.get(CLAIMS_KEY) as Record<string, PortalClaimRecord>;
    expect(Object.keys(raw)).toHaveLength(1);
    expect(hashToken("old-token") in raw).toBe(false);
  });

  it("claim redemption carries the recorded identity into the binding", async () => {
    const { token } = await createPortalClaimToken({ kind: "org_contact", refId: "ct_77", createdBy: "admin@x" });
    await consumePortalClaimToken({ token, userId: "u5", boundBy: "admin@x" });
    expect(await getPortalBinding("u5")).toMatchObject({ kind: "org_contact", refId: "ct_77" });
  });
});
