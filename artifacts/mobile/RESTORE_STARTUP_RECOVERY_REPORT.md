# Finance Hub Restore Startup Recovery

## Observed failure

The iPhone screen reports `Load step: Checking interrupted restore`. Before this fix, `FinanceProvider` caught every restore exception and showed the same generic message, so it did not reveal whether the journal read, SecureStore access, decryption, validation, rollback, or cleanup had failed. The exact exception from the user's previous app bundle is not available to this workspace.

## Confirmed code-level startup risk

`recoverInterruptedRestore()` read the recovery key from SecureStore and attempted to remove it even when no restore journal existed. A SecureStore read or delete failure was allowed to escape. That could prevent an otherwise normal startup when there was no active restore to recover. This behavior is now best-effort only on the no-journal path: cleanup failures are recorded in development diagnostics but do not block access. An active prepared journal still blocks startup whenever its contents or recovery steps cannot be verified or completed safely.

Committed journals are already marked as completed. If their cleanup fails, the app can load the committed finance document while retaining the journal for another cleanup attempt; no rollback is repeated. A prepared journal remains blocking until its encrypted snapshot is verified, original values are restored, and the prepared journal is removed.

## Recovery safety and confidentiality

- New journals use version 2 and store the recovery snapshot only as authenticated encrypted content. The plaintext `originalValues` copy has been removed.
- Legacy version 1 journals remain readable. Recovery validates the encrypted snapshot, rewrites the legacy journal without its plaintext duplicate, and only then restores any saved values. If that journal rewrite fails, finance values are not touched.
- A missing/invalid key, unreadable journal, failed integrity check, invalid snapshot, or failed restore write leaves the prepared journal in place for retry. No app storage reset or dashboard bypass was added.
- If rollback has completed but SecureStore cannot remove the now-orphaned key, the journal is already gone and the app may continue; the key is retried for cleanup later.
- Development logs include the diagnostic code, stage, exception type, and a sanitized exception message. They do not log finance records, PINs, passwords, keys, or decrypted snapshots.
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

Tests cover: no journal; orphaned keys; SecureStore read and delete failures; prepared journals with valid or missing keys; corrupted encrypted content; committed cleanup failure; interrupted rollback and retry; AsyncStorage read, write, and journal-clear failures; legacy v1 migration; repeated retries; and normal finance loading after a successful rollback. Each failure test verifies that saved values are retained or that the recovery journal remains available.

## Verification

- Mobile test suite: **228 passed**
- TypeScript: **passed**
- Localization audit: **passed**, 100% direct English/Arabic source-key coverage
- Expo SDK package check: **passed**, dependencies up to date
- Expo Doctor: **passed**, 20/20 checks
- iOS, Android, and web JavaScript exports: **passed**
- `git diff --check`: **passed**
- Expo Go startup and data recovery on the user's iPhone: **not yet verified**

The user's iPhone data was not accessed or modified during this work. Do not clear app storage. If the current Expo Go bundle still blocks startup, its new screen should show a specific recovery code and operation; that code can identify any remaining device-specific failure.
