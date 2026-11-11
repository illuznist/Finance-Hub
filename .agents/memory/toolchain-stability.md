---
name: Expo toolchain stability
description: Why one-off non-Node scripts can unexpectedly change the runtime and stale the Expo preview.
---

Keep this Node/Expo workspace on its intended language toolchain. Do not invoke Python for small file edits or cleanup scripts.

**Why:** One-off Python scripts used by a helper automatically provisioned a Python runtime and changed the workspace configuration. The environment change also left the Expo preview with stale/disconnected Metro state, unrelated to the financial code.

**How to apply:** Use patches and Node/shell tools for edits. If an unintended runtime is provisioned, restore the intended configuration through package management, then restart the managed Expo workflow once before final browser verification. Do not repeatedly edit source while a financial browser journey is running; full context/router refreshes interrupt forms.
