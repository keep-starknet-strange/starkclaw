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

function signatureToArray(sig: Signature): string[] {
  if (Array.isArray(sig)) return sig;
  // weierstrass signature object: { r, s, recovery? }
  // Convert to the standard starknet.js array format.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = sig as any;
  const r = typeof s?.r === "bigint" ? `0x${s.r.toString(16)}` : String(s?.r);
  const v = typeof s?.s === "bigint" ? `0x${s.s.toString(16)}` : String(s?.s);
  return [r, v];
}

export class SessionKeySigner extends SignerInterface {
  private readonly inner: Signer;
  private readonly sessionPublicKey: string;
  private readonly validUntil: number;

  constructor(sessionPrivateKey: string, validUntil: number, sessionPublicKey?: string) {
    super();
    if (!Number.isInteger(validUntil) || validUntil <= 0) {
      throw new Error("SessionKeySigner: validUntil must be a positive unix timestamp");
    }
    this.inner = new Signer(sessionPrivateKey);
    this.validUntil = validUntil;
    this.sessionPublicKey = sessionPublicKey ?? ec.starkCurve.getStarkKey(sessionPrivateKey);
  }

  async getPubKey(): Promise<string> {
    return this.sessionPublicKey;
  }

  async signMessage(typedData: TypedData, accountAddress: string): Promise<Signature> {
    return this.inner.signMessage(typedData, accountAddress);
  }

  async signTransaction(
    transactions: Call[],
    transactionsDetail: InvocationsSignerDetails
  ): Promise<Signature> {
    const sig = await this.inner.signTransaction(transactions, transactionsDetail);
    const [r, s] = signatureToArray(sig);
    return [this.sessionPublicKey, r, s, `0x${this.validUntil.toString(16)}`];
  }

  async signDeployAccountTransaction(details: DeployAccountSignerDetails): Promise<Signature> {
    return this.inner.signDeployAccountTransaction(details);
  }

  async signDeclareTransaction(details: DeclareSignerDetails): Promise<Signature> {
    return this.inner.signDeclareTransaction(details);
  }
}
