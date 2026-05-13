# FinanceApp

A premium mobile personal finance tracker for managing monthly expenses, EMI installments, income, and budgets — built with a sleek fintech aesthetic inspired by Revolut and Coinbase.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — run the Expo dev server
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `DATABASE_URL` — Postgres connection string (if backend is used)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo 54 + React Native, expo-router (file-based routing)
- State: React Context + AsyncStorage (local persistence)
- Charts: react-native-svg (custom donut charts)
- UI: expo-linear-gradient, @expo/vector-icons (Feather)
- Fonts: Inter (400/500/600/700) via @expo-google-fonts/inter
- API: Express 5 (not yet used by frontend)
- Build: esbuild (CJS bundle for API)

## Where things live

- `artifacts/mobile/` — Expo mobile app
- `artifacts/mobile/app/(tabs)/` — All 5 tab screens
- `artifacts/mobile/context/FinanceContext.tsx` — All app state, types, and CRUD
- `artifacts/mobile/constants/colors.ts` — Design tokens (light + dark)
- `artifacts/api-server/` — Express API (not yet connected)

## Architecture decisions

- Frontend-only on first build: all data stored in AsyncStorage via FinanceContext
- Single context approach: all finance state (expenses, EMIs, accounts, income) in one React context to minimize provider nesting
- Custom donut charts using react-native-svg instead of a chart library
- Dark mode support via `colors.dark` key auto-picked by `useColors()` hook
- Default data pre-populated for demo (Manzoor's finances with SAR currency)

## Product

5-tab mobile finance app:
- **Dashboard** — greeting, total balance, budget progress, insights, expenses list, EMI summary
- **Expenses** — categorized recurring expenses with paid/unpaid toggle, add/delete
- **EMIs** — installment tracking with donut ring charts, mark as paid, summary stats
- **Analytics** — income vs expense bar chart, category breakdown, 6-month trends, KPI cards
- **Wallets** — account cards (bank/cash/savings), income sources, monthly overview

## User preferences

- User name: Manzoor, currency: SAR
- Premium dark fintech aesthetic (deep navy #0B0C1E background in dark mode)
- No emojis anywhere in the UI

## Gotchas

- Restart the Expo workflow only when changing dependencies, not for code changes (HMR handles code)
- `react-native-svg` is used for donut charts — do not use web-only chart libraries
- Always use `useColors()` hook for colors, never hardcode hex values in components
- Tab bar uses `position: absolute` so all screens need bottom padding ~90px

## Pointers

- See the `pnpm-workspace` skill for workspace structure
- See the `expo` skill for mobile development guidelines
