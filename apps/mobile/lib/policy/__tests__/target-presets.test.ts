import { describe, expect, it } from "vitest";

import {
  TARGET_PRESETS,
  getPresetById,
  MAX_ALLOWED_TARGETS,
  padTargets,
  unpadTargets,
  detectPreset,
  labelForAddress,
  ZERO_ADDRESS,
} from "../target-presets";

describe("target-presets", () => {
  describe("getPresetById", () => {
    it("returns the correct preset by id", () => {
      expect(getPresetById("transfers")?.label).toBe("Transfers only");
      expect(getPresetById("avnu_swap")?.label).toBe("AVNU Swap");
      expect(getPresetById("custom")?.label).toBe("Custom");
    });

    it("returns undefined for unknown id", () => {
      expect(getPresetById("unknown" as any)).toBeUndefined();
    });
  });

  describe("MAX_ALLOWED_TARGETS", () => {
    it("is 4", () => {
      expect(MAX_ALLOWED_TARGETS).toBe(4);
    });
  });

  describe("ZERO_ADDRESS", () => {
    it("is the canonical zero address", () => {
      expect(ZERO_ADDRESS).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    });
  });

  describe("padTargets", () => {
    it("pads empty array with zero addresses", () => {
      const result = padTargets([]);
      expect(result).toEqual([
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
      ]);
    });

    it("pads partial array correctly", () => {
      const result = padTargets(["0x111"]);
      expect(result[0]).toBe("0x111");
      expect(result[1]).toBe(ZERO_ADDRESS);
      expect(result[2]).toBe(ZERO_ADDRESS);
      expect(result[3]).toBe(ZERO_ADDRESS);
    });

    it("handles 2 targets", () => {
      const result = padTargets(["0x111", "0x222"]);
      expect(result).toEqual(["0x111", "0x222", ZERO_ADDRESS, ZERO_ADDRESS]);
    });

    it("handles exactly 4 targets", () => {
      const result = padTargets(["0x111", "0x222", "0x333", "0x444"]);
      expect(result).toEqual(["0x111", "0x222", "0x333", "0x444"]);
    });

    it("truncates more than 4 targets", () => {
      const result = padTargets([
        "0x111",
        "0x222",
        "0x333",
        "0x444",
        "0x555",
      ]);
      expect(result).toEqual(["0x111", "0x222", "0x333", "0x444"]);
    });
  });

  describe("unpadTargets", () => {
    it("returns empty array when all zeros", () => {
      const result = unpadTargets([
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
      ]);
      expect(result).toEqual([]);
    });

    it("filters out zero addresses", () => {
      const result = unpadTargets([
        "0x111",
        ZERO_ADDRESS,
        "0x333",
        ZERO_ADDRESS,
      ]);
      expect(result).toEqual(["0x111", "0x333"]);
    });

    it("handles various zero representations", () => {
      expect(unpadTargets(["0x0", "0x0", "0x0", "0x0"])).toEqual([]);
      expect(unpadTargets(["0x111", "0x0", "0x333", "0x0"])).toEqual([
        "0x111",
        "0x333",
      ]);
    });

    it("handles BigInt zero", () => {
      expect(unpadTargets(["0x111", ZERO_ADDRESS, "0x333", ZERO_ADDRESS])).toEqual([
        "0x111",
        "0x333",
      ]);
    });
  });

  describe("detectPreset", () => {
    it("detects transfers (empty array) as wildcard", () => {
      expect(detectPreset([], "sepolia")).toBe("transfers");
    });

    it("detects AVNU swap preset on sepolia", () => {
      const preset = getPresetById("avnu_swap")!;
      const addresses = preset.resolve("sepolia");
      expect(detectPreset(addresses, "sepolia")).toBe("avnu_swap");
    });

    it("returns custom for unknown address sets", () => {
      expect(
        detectPreset(["0x123", "0x456", "0x789", "0xabc"], "sepolia")
      ).toBe("custom");
    });

    it("is case-insensitive", () => {
      const preset = getPresetById("avnu_swap")!;
      const addresses = preset.resolve("sepolia").map((a) =>
        a.toUpperCase()
      );
      expect(detectPreset(addresses, "sepolia")).toBe("avnu_swap");
    });
  });

  describe("labelForAddress", () => {
    it("returns AVNU Router for AVNU exchange", () => {
      const avnuAddr = getPresetById("avnu_swap")!.resolve("sepolia")[3];
      expect(labelForAddress(avnuAddr, "sepolia")).toBe("AVNU Router");
    });

    it("returns token symbol for token addresses", () => {
      expect(
        labelForAddress(
          "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
          "sepolia"
        )
      ).toBe("ETH");
      expect(
        labelForAddress(
          "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
          "sepolia"
        )
      ).toBe("STRK");
      expect(
        labelForAddress(
          "0x0512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343",
          "sepolia"
        )
      ).toBe("USDC");
    });

    it("truncates unknown addresses", () => {
      const result = labelForAddress(
        "0x1234567890abcdef1234567890abcdef12345678",
        "sepolia"
      );
      // slice(0, 10) = "0x12345678", slice(-6) = "345678" → "0x12345678…345678"
      expect(result).toBe("0x12345678…345678");
    });

    it("does not truncate short addresses", () => {
      expect(labelForAddress("0xabc", "sepolia")).toBe("0xabc");
    });
  });

  describe("presets resolve correctly", () => {
    it("transfers returns empty (wildcard)", () => {
      expect(getPresetById("transfers")!.resolve("sepolia")).toEqual([]);
      expect(getPresetById("transfers")!.resolve("mainnet")).toEqual([]);
    });

    it("avnu_swap returns 4 addresses", () => {
      const sepolia = getPresetById("avnu_swap")!.resolve("sepolia");
      expect(sepolia).toHaveLength(4);
      expect(sepolia[0]).toBe(
        "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
      ); // ETH
      expect(sepolia[3]).toBe(
        "0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f"
      ); // AVNU
    });

    it("custom returns empty", () => {
      expect(getPresetById("custom")!.resolve("sepolia")).toEqual([]);
    });
  });
});
