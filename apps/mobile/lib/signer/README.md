# SISNA Signer Client

Typed signer client module for Starkclaw remote signing flows.

This package is the mobile-side boundary for interacting with SISNA signer infrastructure.
It is designed to keep signer integration strict, typed, and auditable.

## Module Overview

Current module layers:

- `keyring-proxy-signer.ts`
  - Starknet `SignerInterface` implementation used by runtime transfer execution.
  - Sends authenticated `X-Keyring-*` requests to SISNA proxy.
  - Validates response shape and signature invariants.
- `runtime-config.ts`
  - Loads remote/local mode and signer credentials.
  - Enforces production transport hardening constraints.
- `pinning.ts`
  - SSL public-key pinning bootstrap for remote signer path.
  - Fail-closed behavior in production remote mode.
- `client.ts`
  - Generic typed HTTP client helper.
  - Primarily useful for compatibility/testing pathways.

## Recommended Runtime Path

Use `KeyringProxySigner` in remote mode.

```typescript
import { getSignerMode, loadRemoteSignerRuntimeConfig } from "@/lib/signer/runtime-config";
import { KeyringProxySigner } from "@/lib/signer/keyring-proxy-signer";

if (getSignerMode() === "remote") {
  const cfg = await loadRemoteSignerRuntimeConfig();

  const signer = new KeyringProxySigner({
    proxyUrl: cfg.proxyUrl,
    accountAddress: "0x...",
    clientId: cfg.clientId,
    hmacSecret: cfg.hmacSecret,
    requestTimeoutMs: cfg.requestTimeoutMs,
    validUntil: 1735689600,
    keyId: cfg.keyId,
    requester: cfg.requester,
    tool: "execute_transfer",
    mobileActionId: "mobile_action_123",
  });
}
```

## Compatibility Client Path

`createSignerClient` remains available for typed HTTP client use-cases.

```typescript
import { createSignerClient } from "@/lib/signer/client";

const client = createSignerClient({
  baseUrl: "https://signer.example.com",
  apiKey: process.env.SIGNER_API_KEY,
  endpointPath: "/v1/sign/session-transaction",
  timeout: 5000,
});
```

## Security Guarantees

Remote signer mode enforces strict production constraints in `runtime-config.ts`:

- `EXPO_PUBLIC_SISNA_PROXY_URL` must be valid `https://...`.
- Loopback signer hosts (`localhost`, `127.0.0.1`, `::1`) are rejected in production.
- `EXPO_PUBLIC_SISNA_MTLS_REQUIRED` must be true in production.
- `EXPO_PUBLIC_SISNA_REQUESTER` must be explicitly set in production.
- `EXPO_PUBLIC_SISNA_PINNED_PUBKEYS` must include at least two base64 `sha256(SPKI)` hashes in production.

Certificate pinning behavior:

- Pinning initializes before remote signing.
- If pinning cannot initialize in remote mode, execution fails closed.
- Expo Go does not provide the required native module. Use a dev/prod build for remote signer testing.

## Error Codes

### `KeyringProxySignerError`

| Code | Meaning |
|------|---------|
| `TIMEOUT` | proxy request timed out |
| `AUTH_REPLAY` | nonce replay/auth replay condition |
| `AUTH_INVALID` | auth header/signature invalid |
| `POLICY_DENIED` | signer policy rejected request |
| `UPSTREAM_UNAVAILABLE` | signer unavailable (503) |
| `UPSTREAM_ERROR` | upstream returned generic error |
| `INVALID_RESPONSE` | signer response shape invalid |
| `NETWORK_ERROR` | network/transport failure |

### `SignerClientError` (`client.ts` path)

| Code | HTTP Status | Retryable |
|------|-------------|-----------|
| `REPLAY_NONCE` | 401 | No |
| `INVALID_AUTH` | 401 | No |
| `POLICY_DENIED` | 403 | No |
| `SERVER_ERROR` | 5xx | Yes |
| `UNAVAILABLE` | 503 | Yes |
| `TIMEOUT` | n/a | Yes |
| `NETWORK_ERROR` | n/a | Yes |
| `UNKNOWN_ERROR` | any | Maybe |
| `VALIDATION_ERROR` | n/a | No |

## Testing

```bash
# signer client focused tests
./scripts/test/signer-client.sh

# module coverage
npm --prefix apps/mobile test -- --run --coverage lib/signer
```

## Non-Goals

This module does not implement:

- contract migration workflows
- contract source changes
- server-side key management logic

## References

- SISNA repository: https://github.com/omarespejel/SISNA
- Starkclaw root README: ../../../../README.md
