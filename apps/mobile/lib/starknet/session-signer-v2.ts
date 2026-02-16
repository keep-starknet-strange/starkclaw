/**
 * session-signer-v2 — Session key signer with strict SNIP-12 v2 support.
 *
 * Session operations produce SNIP-12 typed-data signatures with explicit
 * signature_mode/spec_version markers for strict v2 verification.
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

const SIGNATURE_MODE_V2_FELT = "0x7632"; // shortstring('v2')
const SPEC_VERSION_V2_FELT = "0x2";

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

  constructor(sessionPrivateKey: string, sessionPublicKey?: string) {
    super();
    this.inner = new Signer(sessionPrivateKey);
    this.sessionPublicKey = sessionPublicKey ?? ec.starkCurve.getStarkKey(sessionPrivateKey);
  }

  async getPubKey(): Promise<string> {
    return this.sessionPublicKey;
  }

  async signMessage(typedData: TypedData, accountAddress: string): Promise<Signature> {
    const sig = await this.inner.signMessage(typedData, accountAddress);
    const [r, s] = signatureToArray(sig);
    return [
      this.sessionPublicKey,
      r,
      s,
      SIGNATURE_MODE_V2_FELT,
      SPEC_VERSION_V2_FELT,
    ];
  }

  async signTransaction(
    transactions: Call[],
    transactionsDetail: InvocationsSignerDetails,
  ): Promise<Signature> {
    const sig = await this.inner.signTransaction(transactions, transactionsDetail);
    const [r, s] = signatureToArray(sig);
    return [
      this.sessionPublicKey,
      r,
      s,
      SIGNATURE_MODE_V2_FELT,
      SPEC_VERSION_V2_FELT,
    ];
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
