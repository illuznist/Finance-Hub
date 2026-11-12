# Finance Hub Phase 4: Final Acceptance

## Gate decision

**PASS — proceed to Phase 5.** Signed-in browser acceptance found no critical backup, restore, authentication, or financial-record integrity defect. Workspace security findings and unavailable native-device checks remain documented below; neither is represented as resolved.

All interactive checks used a disposable local browser profile and clearly labeled test records. The existing user profile and production data were not accessed or changed.

## Signed-in backup and restore acceptance

**PASS — authenticated web flow.** A disposable account was created, then a wallet with a zero opening balance and one unpaid SAR 25 expense were added. The expense did not change the wallet's SAR 0 balance.

- **Backup creation and download — PASS.** Created an encrypted backup and verified that the browser downloaded the JSON file. The backup preview identified format v1 and schema v2, with one account and one expense.
- **Incorrect password — PASS.** A wrong password was rejected. The finance document in browser storage was byte-for-byte unchanged.
- **Restore preview and explicit confirmation — PASS.** The correct password produced a preview. After creating a second SAR 7 expense, the previewed backup was explicitly confirmed. Restore returned the finance document to one expense and the original zero-balance wallet; the later expense was absent.
- **Post-restore persistence — PASS.** Reloading the signed-in app retained the restored one-expense state and wallet.
- **Tampered backup — PASS.** Altered encrypted content was rejected before preview, with the saved finance document unchanged.
- **Incompatible schema — PASS.** A validly encrypted backup declaring schema version 999 was rejected before preview, with the saved finance document unchanged.
- **Interrupted restore recovery — PASS in automated recovery tests; NOT TESTED by forcibly terminating the browser during restore.** The existing journal tests cover rollback of a prepared restore and preservation of a committed restore.
- **Secret exclusion — PASS.** Inspection of the decrypted disposable backup found no device security settings, credential verifier fields, or backup password. The implementation report documents exclusion of PINs, verifiers, biometrics, and account credentials.

## Existing verification and security review

- Phase 4 automated suite: **PASS — 190 passed, 0 failed**.
- TypeScript check: **PASS**.
- Expo web, Android, and iOS exports: **PASS**.
- `git diff --check`: **PASS**.
- Expo SDK 58 alignment: **BLOCKED**. The existing check recommends Expo 58.0.24 and related package patches while the project remains on Expo 58.0.23. The workspace's 24-hour package-age safeguard was not bypassed or changed.
- Workspace dependency audit: **125 findings — 12 critical, 62 high, 37 moderate, and 14 low across 32 package versions.** Findings were classified by workspace and dependency path:
  - `orval@8.5.3` is API-spec generation tooling, not a FinanceApp runtime dependency.
  - `proxy-addr@2.0.7`, plus related Express packages such as `body-parser` and `path-to-regexp`, are in the separate API server. This is an outstanding server-side workspace risk; it is not used by the local-only finance ledger or backup flow.
  - The flagged `@xmldom/xmldom`, `node-forge`, `brace-expansion`, `picomatch`, `shell-quote`, and related entries are pulled through Expo CLI/Metro/build tooling. Vite and related entries belong to preview/build tooling. These are not finance calculation modules in the shipped app code.
  - The remaining findings are in the API server, shared schema/code-generation, Expo/toolchain, and other workspace tooling dependency trees. They remain unmodified because Phase 4 prohibited unrelated dependency upgrades. The audit findings remain open for a separately scoped dependency-remediation effort.
- Static analysis: **2 high alerts remain** on the guarded static-file open/read sinks. Canonicalization, root containment, symlink checks, no-follow opening, and traversal tests are documented in the Phase 4 implementation report; the scanner alerts were not suppressed.
- Privacy scan: **1 low finding remains** for account email stored in browser local storage; browser storage is not hardware-backed, as disclosed in the app.
- Finance records remain unencrypted at rest in the existing local storage. Exported backups are encrypted; this is a documented product limitation, not a browser-test failure.

## Checks not available in this acceptance run

- **NOT TESTED:** Physical Expo Go behavior on a phone.
- **NOT TESTED:** Native SecureStore, biometric unlock, screen-capture/app-switcher protections, and native file-picker/share-sheet behavior.
- **NOT TESTED:** Migration of legacy browser profiles.
- **NOT TESTED:** Forced process termination during a live restore; automated journal recovery coverage passed.

## Phase 5 readiness

The required signed-in web backup/restore acceptance gate passed, including wrong-password, corrupted-file, incompatible-schema, confirmed restore, and persistence checks. No critical backup/restore/authentication/financial-integrity defect was found. Phase 5 may proceed while preserving the outstanding workspace security and native-device limitations above. This report does not authorize Phase 6.
