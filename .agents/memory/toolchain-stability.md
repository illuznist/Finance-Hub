---
name: Expo toolchain stability
description: Prevent runtime changes and stale Expo preview configuration during verification.
---

Keep this Node/Expo workspace on its intended language toolchain. Do not invoke Python for small file edits or cleanup scripts.

**Why:** One-off Python scripts used by a helper automatically provisioned a Python runtime and changed the workspace configuration. Separately, an Expo app-version update remained stale in the web runtime manifest after a workflow restart, while the CLI config already reported the new version; clearing the generated Metro transform cache resolved the mismatch.

**How to apply:** Use patches and Node/shell tools for edits. If an unintended runtime is provisioned, restore the intended configuration through package management. After changing Expo app config, compare `expo config --json` with the runtime Settings/About value; if they disagree after a managed workflow restart, clear the generated Metro transform cache and restart once before final browser verification. Do not repeatedly edit source while a financial browser journey is running; full context/router refreshes interrupt forms.
