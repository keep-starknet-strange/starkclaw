#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { Account, RpcProvider, extractContractHashes } from "starknet";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

if (process.env.ALLOW_LEGACY_AGENT_ACCOUNT !== "1") {
  throw new Error(
    "Legacy AgentAccount declare path is disabled by default. " +
      "Use declare-session-account, or set ALLOW_LEGACY_AGENT_ACCOUNT=1 for migration/debug only."
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const rpcUrl =
  process.env.STARKNET_RPC_URL ?? "https://starknet-sepolia-rpc.publicnode.com";
const deployerAddress = requiredEnv("STARKNET_DEPLOYER_ADDRESS");
const deployerPrivateKey = requiredEnv("STARKNET_DEPLOYER_PRIVATE_KEY");

const pkgDir = path.join(repoRoot, "contracts/agent-account");
const targetDir = path.join(pkgDir, "target/dev");

const sierraPath = path.join(
  targetDir,
  "agent_account_AgentAccount.contract_class.json"
);
const casmPath = path.join(
  targetDir,
  "agent_account_AgentAccount.compiled_contract_class.json"
);

async function main() {
  console.log("RPC:", rpcUrl);
  console.log("Deployer:", deployerAddress);
  console.log("Building contracts...");
  execSync("scarb build", { cwd: pkgDir, stdio: "inherit" });

  console.log("Loading artifacts...");
  const sierra = JSON.parse(await readFile(sierraPath, "utf8"));
  const casm = JSON.parse(await readFile(casmPath, "utf8"));

  const hashes = extractContractHashes({ contract: sierra, casm });
  console.log("Computed classHash:", hashes.classHash);
  console.log("Computed compiledClassHash:", hashes.compiledClassHash);

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account({
    provider,
    address: deployerAddress,
    signer: deployerPrivateKey,
  });

  console.log("Declaring (if not already declared)...");
  const resp = await account.declareIfNot({ contract: sierra, casm });

  if (!resp.transaction_hash) {
    console.log("Already declared. classHash:", resp.class_hash);
    return;
  }

  console.log("Declare tx:", resp.transaction_hash);
  await account.waitForTransaction(resp.transaction_hash, {
    retries: 120,
    retryInterval: 3_000,
  });
  console.log("Declared. classHash:", resp.class_hash);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
