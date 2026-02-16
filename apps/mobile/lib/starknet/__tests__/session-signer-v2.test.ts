import { describe, expect, test, vi } from "vitest";

vi.mock("starknet", async () => {
  const signerInstances: any[] = [];

  class MockSigner {
    signMessage = vi.fn(async () => ({ r: 0x11n, s: 0x22n }));
    signTransaction = vi.fn(async () => ({ r: 0x33n, s: 0x44n }));
    signDeployAccountTransaction = vi.fn(async () => ["0xdead"]);
    signDeclareTransaction = vi.fn(async () => ["0xbeef"]);

    constructor(_privateKey: string) {
      signerInstances.push(this);
    }
  }

  return {
    Signer: MockSigner,
    SignerInterface: class {},
    ec: {
      starkCurve: {
        getStarkKey: vi.fn(() => "0xderived"),
      },
    },
    __mock: {
      signerInstances,
    },
  };
});

import { __mock } from "starknet";
import { SessionKeySignerV2 } from "../session-signer-v2";

describe("SessionKeySignerV2", () => {
  test("derives pubkey and returns strict v2 metadata for signMessage", async () => {
    const signer = new SessionKeySignerV2("0xabc");
    const pubKey = await signer.getPubKey();
    expect(pubKey).toBe("0xderived");

    const sig = await signer.signMessage({} as never, "0x123");
    expect(sig).toEqual(["0xderived", "0x11", "0x22", "0x7632", "0x2"]);
  });

  test("uses explicit sessionPublicKey override", async () => {
    const signer = new SessionKeySignerV2("0xabc", "0xexplicit");
    expect(await signer.getPubKey()).toBe("0xexplicit");
  });

  test("accepts array signatures from inner signer", async () => {
    const signer = new SessionKeySignerV2("0xabc");
    const inner = __mock.signerInstances.at(-1);
    inner.signTransaction.mockResolvedValue(["0xaa", "0xbb"]);

    const sig = await signer.signTransaction([] as never, {} as never);
    expect(sig).toEqual(["0xderived", "0xaa", "0xbb", "0x7632", "0x2"]);
  });

  test("passes through deploy/declare signing to inner signer", async () => {
    const signer = new SessionKeySignerV2("0xabc");
    const inner = __mock.signerInstances.at(-1);

    const deployResult = await signer.signDeployAccountTransaction({} as never);
    const declareResult = await signer.signDeclareTransaction({} as never);

    expect(inner.signDeployAccountTransaction).toHaveBeenCalledTimes(1);
    expect(inner.signDeclareTransaction).toHaveBeenCalledTimes(1);
    expect(deployResult).toEqual(["0xdead"]);
    expect(declareResult).toEqual(["0xbeef"]);
  });
});

