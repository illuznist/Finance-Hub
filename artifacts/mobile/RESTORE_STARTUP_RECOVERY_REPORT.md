# Finance Hub Restore Startup Recovery

## Observed failure

The iPhone screen reports `Load step: Checking interrupted restore` and `RESTORE_RECOVERY_FAILED`. The latest Metro log captured the sanitized exception:

```text
Error: Expected HMRClient.setup() call at startup.
```

## Confirmed root cause

`deviceSecurity.ts` used a runtime `import("./restoreJournal.ts")` inside `recoverProtectedRestoreJournal()`. Expo Go's Metro runtime threw `Expected HMRClient.setup() call at startup.` while evaluating that dynamic import, before `recoverInterruptedRestore()` began. As a result, no AsyncStorage journal read or SecureStore access occurred, and no specific restore error could be thrown; the wrapper correctly—but too broadly—reported `RESTORE_RECOVERY_FAILED`.

The running iOS bundle emitted this warning from the newly added diagnostic logger, and the workspace `main` branch matched `origin/main` at commit `0973829` during reproduction. This rules out the old bundle as the cause.

The restore journal functions are now statically imported by `deviceSecurity.ts`, removing the runtime dynamic-import step from app startup. A regression test guards against reintroducing that dynamic import. Development diagnostics now also include a sanitized stack location.

The earlier no-journal safety correction is retained: orphan-key SecureStore cleanup is best-effort only when no restore journal exists, while a prepared restore must still be verified and safely completed before startup. No restore validation is bypassed.

Committed journals are already marked as completed. If their cleanup fails, the app can load the committed finance document while retaining the journal for another cleanup attempt; no rollback is repeated. A prepared journal remains blocking until its encrypted snapshot is verified, original values are restored, and the prepared journal is removed.

## Recovery safety and confidentiality

- New journals use version 2 and store the recovery snapshot only as authenticated encrypted content. The plaintext `originalValues` copy has been removed.
- Legacy version 1 journals remain readable. Recovery validates the encrypted snapshot, rewrites the legacy journal without its plaintext duplicate, and only then restores any saved values. If that journal rewrite fails, finance values are not touched.
- A missing/invalid key, unreadable journal, failed integrity check, invalid snapshot, or failed restore write leaves the prepared journal in place for retry. No app storage reset or dashboard bypass was added.
- If rollback has completed but SecureStore cannot remove the now-orphaned key, the journal is already gone and the app may continue; the key is retried for cleanup later.
- Development logs include the diagnostic code, stage, exception type, sanitized exception message, and stack location. They do not log finance records, PINs, passwords, keys, or decrypted snapshots.
- Retry continues to show a loading state and prevents duplicate attempts. Recovery errors now show the operation, stable code, safe explanation, and a next step in English and Arabic.
- Startup now displays a fallback diagnostic code for unexpected failures too, and recognizes recovery errors by their diagnostic shape so module boundaries cannot hide the code.

## Diagnostic codes

| Code | Meaning |
| --- | --- |
| `RESTORE_JOURNAL_READ_FAILED` | AsyncStorage could not read the restore journal. |
| `RESTORE_JOURNAL_PARSE_FAILED` | The journal structure or status is unsupported or invalid. |
| `RESTORE_JOURNAL_WRITE_FAILED` | A legacy journal could not be rewritten without plaintext fields. |
| `RESTORE_KEY_READ_FAILED` | SecureStore could not read the key for an active prepared journal. |
| `RESTORE_KEY_MISSING` / `RESTORE_KEY_INVALID` | The active journal has no usable recovery key. |
| `RESTORE_DECRYPT_FAILED` | The encrypted snapshot failed decryption or integrity verification. |
| `RESTORE_SNAPSHOT_PARSE_FAILED` / `RESTORE_SNAPSHOT_INVALID` | The decrypted snapshot could not be safely parsed or validated. |
| `RESTORE_ORIGINAL_VALUE_WRITE_FAILED` | A protected original value could not be restored; the prepared journal remains retryable. |
| `RESTORE_JOURNAL_CLEAR_FAILED` | Rollback finished but the prepared journal could not be removed, so startup remains blocked. |
| `RESTORE_KEY_DELETE_FAILED` | A completed or orphaned key could not be removed; this cleanup does not block access once no active journal remains. |

## Regression coverage

Tests cover: static startup imports; no journal; orphaned keys; SecureStore read and delete failures; prepared journals with valid or missing keys; corrupted encrypted content; committed cleanup failure; interrupted rollback and retry; AsyncStorage read, write, and journal-clear failures; legacy v1 migration; repeated retries; and normal finance loading after a successful rollback. Each failure test verifies that saved values are retained or that the recovery journal remains available.

## Verification

- Mobile test suite: **230 passed**
- TypeScript: **passed**
- Localization audit: **passed**, 100% direct English/Arabic source-key coverage
- Expo SDK package check: **passed**, dependencies up to date
- Expo Doctor: **passed**, 20/20 checks
- iOS, Android, and web JavaScript exports: **passed**
- `git diff --check`: **passed**
- Expo Go startup and data recovery on the user's iPhone: **not yet verified**

The user's iPhone data was not accessed or modified during this work. Do not clear app storage. If the current Expo Go bundle still blocks startup, its new screen should show a specific recovery code and operation; that code can identify any remaining device-specific failure.
