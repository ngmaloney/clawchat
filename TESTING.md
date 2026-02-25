# ClawChat Testing Guide

## The Problem

ClawChat gets "missing scope: operator.write" when trying to call RPC methods on the gateway (chat.send, sessions.list, etc.), even though the handshake sends `scopes: ['operator.read', 'operator.write']`.

## Current Status (as of 2026-02-24)

- **ts140 gateway:** OpenClaw 2026.2.23
- **Branch:** `fix/operator-scopes-device-auth` (cherry-picked from PR #3)
- **Client identity:** `client.id: "openclaw-control-ui"`, `mode: "webchat"`
- **Connection:** ✅ Succeeds (logs show "webchat connected")
- **Scopes:** ❌ Not granted (scope errors on RPC calls)

## Manual Testing Steps

### 1. Start dev server

```bash
cd ~/path/to/clawchat
git checkout fix/operator-scopes-device-auth
git pull origin fix/operator-scopes-device-auth
npm run dev
```

### 2. Connect to gateway

- Gateway URL: `ws://ts140.home.wrox.us:18789` (or `ws://localhost:18789` via SSH tunnel)
- Token: `34443b7904a646bd1d0e6814ef348be14d6b4baf61912ceb`

### 3. Check browser console for errors

Open DevTools (Cmd+Option+I) → Console tab

**Expected if working:**
```
[GatewayClient] Handshake complete — connected!
```

**Actual (broken):**
```
⚠ missing scope: operator.write
```

### 4. Check gateway logs

On ts140:
```bash
tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep -E "scope|operator|webchat"
```

**Look for:**
- `"scopes":["operator.read","operator.write"]` in connect request
- Scope grant/deny in response

## Automated Testing (TODO)

Need to create a proper integration test that:

1. Connects to gateway with correct handshake
2. Verifies scopes are granted in hello-ok response
3. Makes a test RPC call (sessions.list)
4. Verifies it doesn't get scope errors

## Known Issues

1. PR #3 may require OpenClaw 2026.2.24+ (ts140 is on 2026.2.23)
2. Client identity (`openclaw-control-ui` / `webchat`) may not be recognized by older gateway versions
3. No automated way to verify scopes work before merging

## Next Steps

1. Update ts140 to latest OpenClaw (2026.2.24+)
2. OR: Test against pinchy.home.wrox.us (already running 2026.2.24)
3. OR: Revert PR #3 changes and implement minimal scope fix ourselves
