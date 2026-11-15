# FinanceApp changelog

## 1.1.3

- Fixed a saved-data migration edge case where an account's opening balance was stored as `null`.
- Recovered the opening balance from the retained account balance and saved an exact compatibility backup before migration writes.
- Preserved existing ledger movements and account balances; no app storage reset is performed.
- Made safe retries visibly show progress and the failed load stage without displaying stored financial values.

## 1.1.2

- Fixed Arabic language switching so Expo Go no longer enters an automatic RTL reload loop.
- Saved language changes immediately; native layout-direction changes now show a clear close-and-reopen notice when needed.
- Serialized rapid language and calendar preference updates to prevent stale writes.
- Aligned Expo SDK 58 packages to the installed SDK's supported patch versions.

## 1.1.1

- Fixed the PIN setup flow and retained safe password recovery without changing existing finance records.
- Fixed responsive Savings card layout for narrow screens and larger accessibility text.
- Added independent Gregorian and Umm al-Qura Hijri display-calendar preferences.
- Completed English and Arabic localization across app-owned screens, forms, errors, alerts, reminders, and empty states.
- Refined Arabic right-to-left layout, back navigation, and Arabic-Indic number formatting.
- Added Arabic-aware plural forms and interpolation for count-based messages.
- Refined UI consistency and performance without changing ledger or forecast calculations.

## 1.1.0

- Fixed PIN setup so saving a new PIN does not immediately lock the active session.
- Kept PIN credentials as salted verifiers in secure storage and made save failures visible.
- Added persistent English/Arabic (Saudi Arabia) and Gregorian/Hijri display preferences.
- Added Arabic-Indic number formatting, localized display dates, RTL direction, and localized numeric input normalization.
- Improved the Home Savings card so large balances wrap inside the card on narrow screens and at larger text sizes.
- Updated the displayed application version to 1.1.0.
