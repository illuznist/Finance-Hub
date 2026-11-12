# Finance Hub Phase 4: Security, Privacy and Data Recovery

## Scope and status

Phase 4 adds local app-lock hardening, encrypted backup export, guarded restore, recovery journaling, storage/privacy copy corrections, and security tests. It does not add a backend, cloud sync, bank connection, financial reset, or ledger behavior changes. Phase 5 was not started.

The user approved continuing with the previously documented Phase 3 gaps. Physical Expo Go acceptance and migration of legacy browser profiles remain unverified.

## Security architecture audit

- Finance records remain in the app's existing local finance document, backed by AsyncStorage on native and browser local storage on web. The app does **not** encrypt that finance document at rest.
- Native records are within the operating system's app sandbox. Browser data is accessible to the browser profile and is not protected by device secure hardware.
- Credentials and PIN verifiers use Expo SecureStore on native platforms. Browser builds use local storage and do not receive equivalent hardware protection.
- Biometrics are opt-in and use the operating system authentication API. The app does not read biometric samples; an availability check alone never unlocks the app.
- Old account password digests are upgraded to salted PBKDF2 verifiers after a successful login. Legacy raw PINs are migrated to a salted verifier before the finance document is migrated. If secure storage cannot save the verifier, startup stops without rewriting the existing finance document or removing the original lock data.
- Finance migration/recovery snapshots have only the device-specific raw PIN field removed after the replacement verifier is safely stored. Other finance values are preserved.
- Error messages avoid printing financial details or credentials. Backup passwords, derived keys, and decrypted backup contents are not logged.

## App lock

- PINs are four digits and stored only as PBKDF2-HMAC-SHA256 verifiers with unique random salts and a 600,000-iteration work factor.
- PIN change and disable require account-password authentication in Settings. PIN creation requires confirmation.
- Wrong PIN attempts receive increasing waits, capped at 30 seconds; access is not permanently locked out. Account-password recovery is available if PIN storage is unavailable.
- The lock is shown after app restart when enabled. Background policy supports immediate locking, configured delays, and never-lock. The app offers PIN fallback if biometrics are unavailable, cancelled, or fail.
- Native builds request screen-capture prevention and iOS app-switcher privacy protection when PIN lock is enabled. These device behaviors were not physically verified.

## Encrypted backup format

- Format: `FINANCE_HUB_ENCRYPTED_BACKUP`, version 1.
- Encryption: AES-256-GCM with authenticated metadata.
- Key derivation: PBKDF2-HMAC-SHA256, 600,000 iterations, a fresh random 16-byte salt, and a 32-byte key.
- Each backup uses a fresh random 12-byte GCM nonce. Backup passwords must be at least 12 characters.
- Files are capped at 64 MiB. The backup includes the finance document, schema metadata, record counts, and theme preference; it excludes security settings, PINs, PIN verifiers, account credentials, and biometric preferences.
- Backups are created locally and exported only when the user chooses to share or save them. The app does not upload them.

## Restore safety

The restore screen imports an encrypted file, requests its password, authenticates and decrypts it, validates metadata and record counts, and previews the date, app/schema versions, and finance record totals before asking for explicit replacement confirmation. Invalid, incomplete, unsupported, or tampered backups are rejected before any finance write.

Current-schema backups must contain the required finance collections and planning/recurring data. The existing migration and ledger validation then checks record identities, amounts, and account balances. Restored security settings stay device-specific.

Before replacement, the app drains queued writes and creates an authenticated, encrypted write-ahead journal of the current finance document and theme preference. An interrupted prepared restore rolls back; a committed restore keeps the replacement. Missing or tampered journal material fails closed and leaves the current finance document untouched. The existing retry gate remains in place; storage is never automatically cleared.

On native, the journal key is held in SecureStore. On web, the key and journal are both in browser local storage, so the journal provides integrity and recovery behavior but not browser-profile confidentiality.

## Dependencies and Expo compatibility

Added minimal dependencies:

- `@noble/hashes@2.4.0` and `@noble/ciphers@2.4.0` for maintained PBKDF2, SHA-256, and AES-GCM implementations compatible with the Expo JavaScript bundle.
- `expo-crypto@58.0.7` for secure random bytes.
- `expo-document-picker@58.0.4` for local backup selection.
- `expo-screen-capture@58.0.6` for native privacy protections.

The project remains on Expo SDK 58. `expo export --platform all` successfully bundled web, Android, and iOS. The Expo alignment check still recommends patch-level updates, including Expo 58.0.23 → 58.0.24 and corresponding SDK package patches. The workspace's 24-hour package-age policy was not weakened; exact patch alignment remains outstanding.

## Changed files

- `context/AuthContext.tsx`, `context/FinanceContext.tsx`, `context/ThemeContext.tsx`
- `app/_layout.tsx`, `app/settings.tsx`, `app/backup.tsx`, `app/legal.tsx`, `app/support.tsx`
- `components/AppLockGate.tsx`, `components/AuthScreen.tsx`, `components/FinanceStorageGate.tsx`
- `finance/migration.ts` and finance migration/ledger tests
- `security/crypto.ts`, `credentials.ts`, `deviceSecurity.ts`, `backup.ts`, `restoreJournal.ts`, `pinVerifier.ts`, `pinPolicy.ts`, `appLockPolicy.ts`, `sanitizeFinanceSnapshot.ts`, and security tests
- `server/safeStaticPath.js`, `server/serve.js`, and static-path tests
- `package.json` test script and dependency declarations

## Verification results

- TypeScript check: passed.
- Full mobile finance, security, and server test suites: 190 passed, 0 failed.
- `git diff --check`: passed.
- Web export: passed.
- Android export: passed.
- iOS export: passed.
- Static path tests reject encoded/plain traversal and symlinks outside the static root.
- Browser preview screenshot: the unauthenticated create-account screen loaded. Signed-in backup/restore UI was not verified because the preview browser is not signed in.
- Physical SecureStore, biometrics, screen capture, file picker, and share-sheet behavior: not tested on a phone.

## Security scan results and remaining risks

- Workspace dependency audit: 125 findings (12 critical, 62 high, 37 moderate, 14 low). These are workspace-wide, not isolated to FinanceApp. The critical entries include `orval@8.5.3` in the API-spec build tooling and `proxy-addr@2.0.7` through the API server. High findings include packages pulled through the existing Expo/tooling dependency tree. Unrelated dependency upgrades were not made, per the Phase 4 scope constraint.
- SAST: two high path-traversal alerts remain on the static-file helper's open/read calls. Those calls follow decoded path checks, root containment, real-path/symlink checks, and a no-follow file open; focused tests pass. The scanner still reports the sinks, so these findings remain visible for review rather than being suppressed.
- Privacy scan: one low finding notes that account email is stored in browser local storage. This is disclosed; browser storage is not hardware-secure.
- Browser app data and the local finance document are not encrypted at rest. A user-selected exported backup is password-encrypted.
- Expo Go and native device security flows still require physical-device acceptance. The prior Phase 3 browser-profile migration gap also remains.
