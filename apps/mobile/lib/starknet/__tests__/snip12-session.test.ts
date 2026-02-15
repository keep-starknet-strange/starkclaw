/**
 * Deterministic serialization tests for SNIP-12 session typed-data builders.
 *
 * Ensures: same input ⇒ same typed-data output (field order, hex encoding,
 * domain construction). Critical for signature reproducibility.
 */

import {
  buildRegisterSessionKeyTypedData,
  buildRevokeSessionKeyTypedData,
  buildEmergencyRevokeAllTypedData,
  signerMetadata,
  type SignerMode,
} from "../snip12-session";

// ── Fixtures ────────────────────────────────────────────────────────

const CHAIN_ID = "0x534e5f5345504f4c4941"; // SN_SEPOLIA
const ACCOUNT = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SESSION_KEY = "0xabc123";
const TOKEN = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
const CONTRACT_0 = "0x0444";
const CONTRACT_1 = "0x0555";
const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

// ── Register Session Key ────────────────────────────────────────────

describe("buildRegisterSessionKeyTypedData", () => {
  const params = {
    chainId: CHAIN_ID,
    accountAddress: ACCOUNT,
    mode: "v2" as SignerMode,
    sessionKey: SESSION_KEY,
    validAfter: 1000,
    validUntil: 2000,
    spendingLimitLow: "0x64",
    spendingLimitHigh: "0x0",
    spendingToken: TOKEN,
    allowedContract0: CONTRACT_0,
    allowedContract1: CONTRACT_1,
    allowedContract2: ZERO,
    allowedContract3: ZERO,
  };

  test("produces deterministic output (same input = same output)", () => {
    const a = buildRegisterSessionKeyTypedData(params);
    const b = buildRegisterSessionKeyTypedData(params);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("domain uses v2 version when mode is v2", () => {
    const td = buildRegisterSessionKeyTypedData(params);
    expect(td.domain.version).toBe("2");
    expect(td.domain.name).toBe("Starkclaw");
    expect(td.domain.chainId).toBe(CHAIN_ID);
    expect(td.domain.verifyingContract).toBe(ACCOUNT);
  });

  test("domain uses v1 version when mode is v1", () => {
    const td = buildRegisterSessionKeyTypedData({ ...params, mode: "v1" });
    expect(td.domain.version).toBe("1");
  });

  test("primaryType is RegisterSessionKey", () => {
    const td = buildRegisterSessionKeyTypedData(params);
    expect(td.primaryType).toBe("RegisterSessionKey");
  });

  test("message fields are correctly hex-encoded", () => {
    const td = buildRegisterSessionKeyTypedData(params);
    const msg = td.message as Record<string, string>;
    expect(msg.session_key).toBe(SESSION_KEY);
    expect(msg.valid_after).toBe("0x3e8"); // 1000
    expect(msg.valid_until).toBe("0x7d0"); // 2000
    expect(msg.spending_limit_low).toBe("0x64");
    expect(msg.spending_limit_high).toBe("0x0");
    expect(msg.spending_token).toBe(TOKEN);
    expect(msg.allowed_contract_0).toBe(CONTRACT_0);
    expect(msg.allowed_contract_1).toBe(CONTRACT_1);
    expect(msg.allowed_contract_2).toBe(ZERO);
    expect(msg.allowed_contract_3).toBe(ZERO);
  });

  test("types include StarknetDomain and RegisterSessionKey", () => {
    const td = buildRegisterSessionKeyTypedData(params);
    expect(td.types).toHaveProperty("StarknetDomain");
    expect(td.types).toHaveProperty("RegisterSessionKey");
    expect(td.types.RegisterSessionKey).toHaveLength(10);
  });

  test("field order in RegisterSessionKey type is deterministic", () => {
    const td = buildRegisterSessionKeyTypedData(params);
    const fieldNames = td.types.RegisterSessionKey.map(
      (f: { name: string }) => f.name,
    );
    expect(fieldNames).toEqual([
      "session_key",
      "valid_after",
      "valid_until",
      "spending_limit_low",
      "spending_limit_high",
      "spending_token",
      "allowed_contract_0",
      "allowed_contract_1",
      "allowed_contract_2",
      "allowed_contract_3",
    ]);
  });
});

// ── Revoke Session Key ──────────────────────────────────────────────

describe("buildRevokeSessionKeyTypedData", () => {
  const params = {
    chainId: CHAIN_ID,
    accountAddress: ACCOUNT,
    mode: "v2" as SignerMode,
    sessionKey: SESSION_KEY,
  };

  test("produces deterministic output", () => {
    const a = buildRevokeSessionKeyTypedData(params);
    const b = buildRevokeSessionKeyTypedData(params);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("primaryType is RevokeSessionKey", () => {
    const td = buildRevokeSessionKeyTypedData(params);
    expect(td.primaryType).toBe("RevokeSessionKey");
  });

  test("message contains session_key", () => {
    const td = buildRevokeSessionKeyTypedData(params);
    const msg = td.message as Record<string, string>;
    expect(msg.session_key).toBe(SESSION_KEY);
  });

  test("types include RevokeSessionKey with 1 field", () => {
    const td = buildRevokeSessionKeyTypedData(params);
    expect(td.types.RevokeSessionKey).toHaveLength(1);
    expect(td.types.RevokeSessionKey[0].name).toBe("session_key");
  });
});

// ── Emergency Revoke All ────────────────────────────────────────────

describe("buildEmergencyRevokeAllTypedData", () => {
  const params = {
    chainId: CHAIN_ID,
    accountAddress: ACCOUNT,
    mode: "v2" as SignerMode,
    nonce: 42,
    timestamp: 1700000000,
  };

  test("produces deterministic output", () => {
    const a = buildEmergencyRevokeAllTypedData(params);
    const b = buildEmergencyRevokeAllTypedData(params);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("primaryType is EmergencyRevokeAll", () => {
    const td = buildEmergencyRevokeAllTypedData(params);
    expect(td.primaryType).toBe("EmergencyRevokeAll");
  });

  test("message fields are hex-encoded", () => {
    const td = buildEmergencyRevokeAllTypedData(params);
    const msg = td.message as Record<string, string>;
    expect(msg.nonce).toBe("0x2a"); // 42
    expect(msg.timestamp).toBe("0x6553f100"); // 1700000000
  });

  test("types include EmergencyRevokeAll with 2 fields", () => {
    const td = buildEmergencyRevokeAllTypedData(params);
    expect(td.types.EmergencyRevokeAll).toHaveLength(2);
  });
});

// ── Signer Metadata ─────────────────────────────────────────────────

describe("signerMetadata", () => {
  test("v1 mode returns correct metadata", () => {
    const meta = signerMetadata("v1");
    expect(meta.signature_mode).toBe("v1");
    expect(meta.spec_version).toBe("1");
    expect(meta.domain_name).toBe("Starkclaw");
  });

  test("v2 mode returns correct metadata", () => {
    const meta = signerMetadata("v2");
    expect(meta.signature_mode).toBe("v2");
    expect(meta.spec_version).toBe("2");
    expect(meta.domain_name).toBe("Starkclaw");
  });
});

// ── Cross-mode determinism ──────────────────────────────────────────

describe("cross-mode determinism", () => {
  test("v1 and v2 produce different typed data (version differs)", () => {
    const base = {
      chainId: CHAIN_ID,
      accountAddress: ACCOUNT,
      sessionKey: SESSION_KEY,
    };
    const v1 = buildRevokeSessionKeyTypedData({ ...base, mode: "v1" });
    const v2 = buildRevokeSessionKeyTypedData({ ...base, mode: "v2" });

    expect(v1.domain.version).toBe("1");
    expect(v2.domain.version).toBe("2");
    expect(JSON.stringify(v1)).not.toBe(JSON.stringify(v2));
  });

  test("same mode, different accounts produce different typed data", () => {
    const base = {
      chainId: CHAIN_ID,
      mode: "v2" as SignerMode,
      sessionKey: SESSION_KEY,
    };
    const a = buildRevokeSessionKeyTypedData({
      ...base,
      accountAddress: "0x111",
    });
    const b = buildRevokeSessionKeyTypedData({
      ...base,
      accountAddress: "0x222",
    });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});
