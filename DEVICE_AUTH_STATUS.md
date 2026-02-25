# Device Authentication Status

## Problem Summary

ClawChat cannot grant operator scopes due to a device authentication signature mismatch with the OpenClaw gateway.

## Current State (2026-02-24)

**What works:**
- ✅ WebSocket connection to gateway
- ✅ Challenge/handshake flow completes
- ✅ Connection shows as "connected"

**What doesn't work:**
- ❌ Operator scopes are NOT granted
- ❌ Any RPC call requiring `operator.read` or `operator.write` fails with "missing scope" error
- ❌ Cannot list sessions, send messages, or perform any operator actions

## Root Cause

The OpenClaw gateway **requires device authentication** (ECDSA P-256 signature) to grant operator scopes. 

PR #3 (fix/protocol-v3-scopes) added device crypto but the signature format is incompatible with what the gateway expects:
- Gateway returns: `device signature invalid`
- Test confirms: Handshake succeeds WITHOUT device auth, but NO scopes granted

## What I Tested

1. ✅ Correct scopes requested: `['operator.admin', 'operator.approvals', 'operator.pairing']`
2. ✅ Correct client identity: `id: 'cli', mode: 'cli'`
3. ✅ Signature payload format matches Control UI: `v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce`
4. ❌ Signature still rejected by gateway
5. ✅ Handshake succeeds without device field
6. ❌ But no scopes granted without device auth

## Options

### Option 1: Use Official Control UI (Recommended for now)
The official OpenClaw Control UI at `http://localhost:18789/` works properly with device authentication.

### Option 2: Debug Device Signature Format
The signature is currently generated as:
```typescript
const payloadStr = ['v2', deviceId, clientId, clientMode, role, scopes.join(','), signedAtMs, token||'', nonce].join('|')
const signature = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, privateKey, encoder.encode(payloadStr))
return base64(signature) // or base64url?
```

Possible issues:
- Base64 vs base64url encoding?
- Public key format (SPKI)?
- Signature encoding?
- Missing field in payload?

### Option 3: Request OpenClaw Team Support
File an issue with the OpenClaw project asking for:
- Documentation of exact device auth signature format
- Example code for third-party clients
- Or: support for token-only operator auth (no device requirement)

## Next Steps

**For immediate use:** Use the official Control UI at http://localhost:18789/

**To fix ClawChat:** Need to either:
1. Debug signature format by comparing byte-for-byte with working Control UI
2. Get help from OpenClaw maintainers
3. Wait for official third-party client documentation

---

*Last updated: 2026-02-24 21:13 EST*
