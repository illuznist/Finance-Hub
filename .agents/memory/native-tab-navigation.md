---
name: Native tab navigation
description: Avoid unreachable secondary screens when using Expo native tabs.
---

Do not use a hidden NativeTabs trigger for a screen that users must open from More or another menu. Use a stack screen outside the native tab navigator.

**Why:** Expo Router's native-tabs API explicitly makes hidden triggers impossible to navigate to. Classic tabs may allow hidden destinations, so browser checks can miss this iPhone-only failure. Changing URL paths does not remove that restriction.

**How to apply:** Preserve the five primary tabs and open secondary tools through the surrounding stack, with a back action returning to their entry screen. Check both native and classic navigation configuration when adding menu destinations.

Keep EMIs and Loans as separate primary destinations; do not combine them into a shared Credit tab.

**Why:** The user explicitly chose to keep EMIs and Loans separate when replacing More.

**How to apply:** Preserve that separate access in future navigation refinements unless the user changes their preference.
