# Security Policy

## Supported Versions

Starkclaw is currently in **experimental development** (pre-v1.0). We do not recommend production use with real funds at this stage.

| Version | Status |
|---------|--------|
| main branch | Experimental - Active development |
| Releases | Not yet published |

## Reporting a Vulnerability

**Do not open public issues for security vulnerabilities.**

If you discover a security issue in Starkclaw, please report it privately:

### Preferred Contact Method
- **GitHub Security Advisories**: [Report a vulnerability](https://github.com/keep-starknet-strange/starkclaw/security/advisories/new)

### Alternative Contact
- Email: security@starkware.co (mention "Starkclaw" in subject)

### What to Include
When reporting a vulnerability, please provide:

1. **Type of issue**: (e.g., key leakage, policy bypass, injection, cryptographic flaw)
2. **Full paths** to affected source files
3. **Location** of the vulnerable code (tag/branch/commit or direct URL)
4. **Step-by-step instructions** to reproduce the issue
5. **Proof-of-concept or exploit code** (if available)
6. **Impact**: What an attacker could achieve
7. **Suggested fix** (if you have one)

## Scope

### In Scope
Security issues in the following components are in scope:

- **Mobile app** (`apps/mobile/`):
  - Key storage and biometric gating
  - RPC client authentication/integrity
  - Agent runtime tool validation
  - Session key handling
  - Transaction signing flows

- **Cairo contracts** (`contracts/`):
  - Session key policy enforcement
  - Spending limit bypass
  - Multi-target allowlist validation
  - Account abstraction security
  - Signature validation

- **Agent runtime** (if/when implemented):
  - Tool call validation and sandboxing
  - Prompt injection defenses
  - Audit log integrity

### Out of Scope
- Vulnerabilities in dependencies (report to upstream; we will coordinate updates)
- Social engineering attacks
- Physical device compromise
- Starknet protocol vulnerabilities (report to Starkware)
- Public RPC endpoint availability/reliability

## Response Timeline

- **Initial response**: Within 72 hours
- **Status update**: Within 7 days
- **Fix timeline**: Depends on severity
  - **Critical** (key theft, fund loss): 48-72 hours
  - **High** (policy bypass, DoS): 1-2 weeks
  - **Medium/Low**: Next planned release

## Disclosure Policy

We follow **coordinated disclosure**:

1. You report the issue privately
2. We confirm and develop a fix
3. We coordinate a disclosure date with you (typically 90 days from report)
4. We publish a security advisory with credit to you (if desired)
5. You may publish your findings after the advisory

## Security Best Practices (For Contributors)

When contributing to Starkclaw:

- **Never commit secrets**: No private keys, mnemonics, API keys in code or logs
- **Minimize `unsafe` blocks**: If required, add detailed justification comments
- **Validate all inputs**: Especially RPC responses, user inputs, and agent tool arguments
- **Check ERC-20 return values**: Always validate token transfer results
- **Test policy boundaries**: Add tests for bypass attempts, overflow/underflow
- **Follow the principle of least privilege**: Session keys should have minimal necessary permissions

Run `./scripts/check` before every commit to catch common issues.

## Acknowledgments

We appreciate the security research community's efforts to keep Starknet and its ecosystem safe. Responsible disclosures help us protect users and improve the project.
