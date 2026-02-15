/**
 * session-signer-v2 — Feature-flagged session key signer with SNIP-12 support.
 *
 * When session_signer_v2 flag is enabled, session operations produce
 * SNIP-12 typed-data signatures with explicit signature_mode and
 * spec_version metadata. When disabled, falls back to v1 behavior.
 *
 * Security invariant: No silent fallback from v2 to v1. If v2 is
 * requested but fails, the error propagates — never degrades silently.
 */

import {
  Signer,
  SignerInterface,
  ec,
  type Call,
  type DeclareSignerDetails,
  type DeployAccountSignerDetails,
  type InvocationsSignerDetails,
  type Signature,
  type TypedData,
} from "starknet";

import { isEnabled } from "./feature-flags";
import { signerMetadata, type SignerMode } from "./snip12-session";

function signatureToArray(sig: Signature): string[] {
  if (Array.isArray(sig)) return sig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = sig as any;
  const r = typeof s?.r === "bigint" ? `0x${s.r.toString(16)}` : String(s?.r);
  const v = typeof s?.s === "bigint" ? `0x${s.s.toString(16)}` : String(s?.s);
  return [r, v];
}

export class SessionKeySignerV2 extends SignerInterface {
  private readonly inner: Signer;
  private readonly sessionPublicKey: string;
  private modeOverride: SignerMode | null = null;

  constructor(sessionPrivateKey: string, sessionPublicKey?: string) {
    super();
    this.inner = new Signer(sessionPrivateKey);
    this.sessionPublicKey = sessionPublicKey ?? ec.starkCurve.getStarkKey(sessionPrivateKey);
  }

  /** Force a specific signer mode (for testing). */
  setModeOverride(mode: SignerMode | null): void {
    this.modeOverride = mode;
  }

  private async resolveMode(): Promise<SignerMode> {
    if (this.modeOverride) return this.modeOverride;
    const v2 = await isEnabled("session_signer_v2");
    return v2 ? "v2" : "v1";
  }

  async getPubKey(): Promise<string> {
    return this.sessionPublicKey;
  }

  async signMessage(typedData: TypedData, accountAddress: string): Promise<Signature> {
    const mode = await this.resolveMode();
    const sig = await this.inner.signMessage(typedData, accountAddress);
    const [r, s] = signatureToArray(sig);
    const meta = signerMetadata(mode);

    // v2 signatures include mode metadata in the signature array.
    if (mode === "v2") {
      return [
        this.sessionPublicKey,
        r,
        s,
        meta.signature_mode,
        meta.spec_version,
      ];
    }

    // v1: classic 3-element signature.
    return [this.sessionPublicKey, r, s];
  }

  async signTransaction(
    transactions: Call[],
    transactionsDetail: InvocationsSignerDetails,
  ): Promise<Signature> {
    const mode = await this.resolveMode();
    const sig = await this.inner.signTransaction(transactions, transactionsDetail);
    const [r, s] = signatureToArray(sig);
    const meta = signerMetadata(mode);

    if (mode === "v2") {
      return [
        this.sessionPublicKey,
        r,
        s,
        meta.signature_mode,
        meta.spec_version,
      ];
    }

    return [this.sessionPublicKey, r, s];
  }

  async signDeployAccountTransaction(
    details: DeployAccountSignerDetails,
  ): Promise<Signature> {
    // Deploy account always uses owner signer, not session key.
    return this.inner.signDeployAccountTransaction(details);
  }

  async signDeclareTransaction(
    details: DeclareSignerDetails,
  ): Promise<Signature> {
    // Declare always uses owner signer, not session key.
    return this.inner.signDeclareTransaction(details);
  }
}
