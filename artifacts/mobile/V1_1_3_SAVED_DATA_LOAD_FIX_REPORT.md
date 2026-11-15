# Finance Hub v1.1.3 Saved-Data Load Fix

## Failure path

The protected-data banner is set when the finance provider catches an error during recovery, PIN migration, finance migration, validation, or writing the migrated state. The banner intentionally does not show the raw storage exception.

The migration already repaired accounts whose `openingBalance` field was absent, using the retained account `balance` as the historical starting snapshot. It did not treat `openingBalance: null` the same way. That shape passed the earlier missing-field check, then failed the numeric opening-balance validation and produced the generic protected-data banner. This matches the previously reported opening-balance error. The contents of the user's iPhone storage were not accessed, so the specific account value on that device could not be independently inspected.

## Safe repair

- A `null` opening balance is now treated as missing and restored from that account's retained balance.
- Before the migrated document is written, the loader saves the exact original JSON in the compatibility backup slot. If backup creation fails, it does not write the repaired primary document.
- Existing transactions and payment histories are not replayed, removed, or rewritten. A regression test checks that a retained balance of 1,000 and an existing 150 ledger movement still load as 1,150.
- This is a compatibility repair for existing records, not a default change. New accounts continue to start at zero.
- No app storage is cleared or reset.

## Version and verification

- Expo app version: **1.1.3** in `app.json`; Settings/About continues to display the dynamic version.
- Private workspace package version and native build-number/version-code strategy are unchanged.
- `CHANGELOG.md` and `LOCALIZATION_UI_STABILIZATION_REPORT.md` include this milestone.
- No app store publish or GitHub release was created.

| Check | Result |
| --- | --- |
| Full mobile test suite | **Pending final run** |
| TypeScript | **Pending final run** |
| Localization and release metadata | **Pending final run** |
| Expo SDK package check / Expo Doctor | **Previously passed for the same SDK 58 package set** |
| Web, iOS, and Android JavaScript exports | **Pending final run** |
| Physical iPhone data recovery | **Pending user verification; device storage is not accessible from this workspace** |

After updating the Expo Go project from the current QR code, tap **Retry safely** once. Do not uninstall FinanceApp or clear app storage. If the protected-data message remains, share a screenshot of the full screen and whether the message changes after that single retry; keep the phone's app data intact.
