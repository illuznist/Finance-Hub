---
name: TOTP iPhone verification
description: User-confirmed physical iPhone test coverage for online-account TOTP.
---

The user confirmed that authenticator enrollment, verified-factor display, sign-out/sign-in challenge, and account access after entering a TOTP code all worked on their physical iPhone.
The user later confirmed that a live assurance check on that iPhone returned `currentLevel=aal2` and `nextLevel=aal2`.

**Why:** these user-observed results are not recoverable from the repository and distinguish verified MFA behavior from untested password recovery or other devices.

**How to apply:** treat TOTP enrollment, fresh sign-in, and AAL2 assurance as user-verified on one physical iPhone; do not infer that password recovery or other devices were tested.
