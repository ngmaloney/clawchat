# ClawChat Feature Ideas

Ideas to revisit for future enhancements.

---

## 🔊 Audio
- **New message sound** — simple notification chime
- **TTS readback** — have messages read aloud (system TTS or OpenClaw TTS integration)
- **Voice input** — microphone → speech-to-text → send as message

> TTS readback ties naturally into what OpenClaw already does — could be a nice extension.

---

## ♿ ADA / Accessibility
- **Keyboard navigation** — full app usable without a mouse
- **Screen reader support** — proper ARIA labels, roles, live regions for new messages
- **Font size / zoom controls** — `webContents.setZoomLevel` makes this easy in Electron
- **High contrast mode** — respect system preference or add manual toggle
- **Focus indicators** — visible focus rings on all interactive elements

> Accessibility is harder to retrofit later — good long-term investment.

---

## 💬 Chat Quality
- **Markdown rendering** — spiked once, didn't work; worth revisiting (`marked` + `DOMPurify`)
- **Code block syntax highlighting**
- **Message search** — search within session history
- **Copy message button** — one-click copy on individual messages

---

## 🖥️ UX / Polish
- **System tray** — minimize to tray, unread badge, quick access
- **Desktop notifications** — notify on new messages when unfocused
- **Auto-reconnect** — graceful reconnect with backoff if gateway drops
- **Connection status indicator** — clear visual for connected/disconnected/reconnecting

---

## 📁 Session Management
- **Saved connections** — store multiple gateway URLs/tokens, switch easily
- **Session pinning** — pin frequently used sessions to top of list

---

## 📎 File Handling
- **Drag & drop file upload** — easier than file picker
- **Image preview inline** — show images in chat instead of just a link

---

## ⌨️ Developer-Oriented
- **Keyboard shortcuts** — power user navigation (new session, switch session, etc.)
- **Export conversation** — save session as markdown or JSON

---

## 📋 Slash Commands / Gateway Features
- **`/cron` or `/tasks`** — list, add, remove, enable/disable scheduled jobs from ClawChat via `cron.list` / `cron.add` / `cron.remove` gateway API. Render results as structured cards (job name, schedule, next run, status toggle)
- **`/models`** — model picker via `models.list`, let users switch models per session
- **`/devices`** — device pairing management via `device.pair.list` / `device.pair.approve`. Approve new clients directly from ClawChat
- **Exec approvals** — handle `exec.approval.requested` events, show approve/deny UI for sandbox/elevated commands
- **Rich slash command responses** — render system responses (cron list, model list, device list) as styled cards instead of plain text
- **Command palette** — `Cmd+K` for quick access to non-chat actions (switch model, manage cron, approve devices)

---

_Last updated: 2026-03-18_
