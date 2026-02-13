import { secureGet, secureSet } from "../storage/secure-store";

const ACTIVITY_ID = "starkclaw.activity.v1";

export type ActivityStatus = "pending" | "succeeded" | "reverted" | "unknown";

export type ActivityItem = {
  id: string;
  createdAt: number; // unix seconds
  networkId: string;
  kind:
    | "deploy_account"
    | "register_session_key"
    | "revoke_session_key"
    | "emergency_revoke_all"
    | "transfer"
    | "swap";
  summary: string;
  txHash?: string;
  status: ActivityStatus;
  executionStatus?: string | null;
  revertReason?: string | null;
};

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

async function loadIndex(): Promise<ActivityItem[]> {
  const raw = await secureGet(ACTIVITY_ID);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ActivityItem[];
  } catch {
    return [];
  }
}

async function saveIndex(items: ActivityItem[]): Promise<void> {
  await secureSet(ACTIVITY_ID, JSON.stringify(items));
}

export async function listActivity(): Promise<ActivityItem[]> {
  const items = await loadIndex();
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

export async function appendActivity(
  item: Omit<ActivityItem, "id" | "createdAt">
): Promise<ActivityItem> {
  const items = await loadIndex();
  const next: ActivityItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: nowSec(),
    ...item,
  };
  items.push(next);
  await saveIndex(items);
  return next;
}

export async function updateActivityByTxHash(
  txHash: string,
  patch: Partial<ActivityItem>
): Promise<void> {
  const items = await loadIndex();
  const i = items.findIndex((x) => x.txHash === txHash);
  if (i < 0) return;
  items[i] = { ...items[i], ...patch };
  await saveIndex(items);
}

