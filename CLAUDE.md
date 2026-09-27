# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LLKA-V** is the staff front-end of the leih.lokal lending library: customers, items (with multiple copies), rentals (with partial returns), reservations, bookings of protected items, a dashboard, and admin tools (overdue list, system check, label designer, logs, settings). Next.js 16 (App Router) + React 19 + strict TypeScript, talking to a PocketBase 0.26 backend whose schema, API rules and hooks live in [leihbackend](https://github.com/leih-lokal/leihbackend). The UI text is German.

## Commands

```bash
npm run dev                              # Dev server on localhost:3000
npx vitest run                           # Unit tests once (npm run test = watch mode)
npx tsc --noEmit                         # Type check (npm run type-check)
npx eslint app components hooks lib types  # Lint the sources (same as CI)
```

**Note**: User handles building (`npm run build`) themselves - no need to build unless explicitly requested.

The app can't run without a PocketBase server; validate changes with tsc, vitest, eslint and careful reading. `npm run test:e2e`, `test:ui` and `test:coverage` exist in package.json but have no tests/tooling behind them.

CI (`.github/workflows/check.yml`) runs tsc, vitest and eslint on every push and PR; eslint errors fail it, warnings don't. `.github/workflows/nextjs.yml` deploys `main` to GitHub Pages.

## Architecture

### Rendering and deployment
- **Everything is a client component.** Each browser picks its own PocketBase server on the login page, so nothing can be fetched at build or request time. All pages, `app/(dashboard)/layout.tsx` and the error boundaries are `'use client'`; the only server components are static shells (`app/layout.tsx`, `app/not-found.tsx`, the setup layout) and the redirecting `app/page.tsx`. Don't add server-side data fetching.
- **Static export by default** (`output: 'export'`, `out/`). `DOCKER_BUILD=true` switches to `standalone` (see Dockerfile/DOCKER.md). `BASE_PATH` sets a sub-path (GitHub Pages uses `/llka-verwaltung`); reference files in `public/` with `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/file`.
- The dashboard layout renders nothing until the auth check has run on the client, so providers and pages inside it never hydrate server HTML (lazy `useState` initialisers may read localStorage there).
- No PWA/service worker, no server components for data, no global state library: React context providers (settings, identity, command menu, quick find, sequential mode, keyboard shortcuts) in `app/(dashboard)/layout.tsx`.

### Directory structure

```
app/
  (auth)/login/            Login: server URL + superuser credentials
  (dashboard)/             layout.tsx (auth gate, providers, navbar), error.tsx
    dashboard/ customers/ items/ items/analytics/ rentals/ reservations/
    bookings/ overdue/ system-check/ label-designer/ logs/ settings/ setup/
components/
  ui/                      shadcn/ui primitives (no `form` component; use react-hook-form directly)
  table/                   List building blocks: sortable-header, column-selector, empty-state,
                           row-open-button, highlight-marker
  detail-sheets/           Create/edit sheets per entity, form-help-panel, highlight-color-picker
  layout/                  navbar.tsx (main nav + overflow menu), nav-link.tsx, identity-picker.tsx
  search/                  search-bar, filter-popover, global-command-menu, quick-find-modal
  dashboard/ bookings/ overdue/ print/ sequential-mode/ settings/ label-designer/ …
hooks/                     use-auth, use-filters, use-column-visibility, use-settings (.tsx),
                           use-identity (.tsx), use-command-menu (.tsx), use-quick-find (.tsx),
                           use-sequential-mode (.tsx), use-keyboard-shortcuts (.tsx),
                           use-realtime-subscription, use-realtime-connection,
                           use-unreturned-rentals, use-booking-grid, use-dashboard-preferences,
                           use-help-collapsed
lib/
  pocketbase/              client.ts (pb, collections), auth.ts, realtime.ts, settings-schema.ts
  api/                     bookings.ts, stats.ts
  filters/                 filter-configs.ts (per-entity filters), filter-utils.ts
  tables/                  column-configs.ts (per-entity columns, default sort)
  constants/               statuses.ts, categories.ts, colors.ts, documentation.ts (form help)
  utils/                   Domain helpers (see below)
  utils.ts                 cn()
  image/ keyboard-shortcuts/
types/index.ts             All shared types and enums
```

Imports use the `@/` alias (`@/lib/utils` resolves to `lib/utils.ts`).

## PocketBase

- **Client**: `import { pb, collections } from '@/lib/pocketbase/client'`. `pb` is a Proxy that re-creates the SDK client when the server URL changes. The URL comes from an in-flight login attempt, else localStorage `pocketbase_url` (written only after a successful login), else `NEXT_PUBLIC_POCKETBASE_URL`, else `http://localhost:8090`; read it with `getServerUrl()`. Never hardcode it.
- **Collections**: `collections.customers()`, `.customerRentals()` (stats view), `.items()`, `.rentals()`, `.reservations()`, `.bookings()`, `.notes()`, `.settings()`. There is no log collection: logs come from `pb.send('/api/logs')`, dashboard stats from `pb.send('/api/stats')` (`lib/api/stats.ts`).
- **Auth**: superusers (`_superusers`). `lib/pocketbase/auth.ts` (login/logout/refresh, one shared auto-refresh interval) and `hooks/use-auth.ts` (`useAuth`, `useRequireAuth`). A 401 on a request made with the current token clears the auth store, which routes to `/login`.
- **Filters**: pass every value through `pb.filter()`, one key per call for user input (with several keys in one call, a value like `{:b}` gets substituted too). Helpers in `lib/filters/filter-utils.ts`: `buildCustomerSearchFilter(term)` (iid / name search used by all customer pickers), `buildBookingSiblingFilter(booking)` (all records of one multi-copy booking), `buildRecordInListFilter(id, listFilter)` (does a record match the list's current filters), `buildPocketBaseFilter` (used by `use-filters`).
- **Realtime**: `useRealtimeSubscription(collection, { onCreated, onUpdated, onDeleted, onResubscribe, filter, enabled })`. Callbacks are kept in refs (no re-subscribe when they change). Subscriptions pause while the tab is hidden; missed events are not replayed, so every call site passes `onResubscribe` to refetch (list pages reuse their reset-and-load-page-1 path). `useRealtimeConnection()` exposes the connection state and `reconnect`; `components/ui/realtime-status.tsx` shows it as a toast.

## Domain Model (`types/index.ts`)

- Records extend `BaseRecord` (`id`, `created`, `updated`). Show the integer `iid` to users (formatted with `FormattedId` / the ID format setting), use `id` in code. `*Expanded` types carry `expand` relations; `CustomerWithStats` / `ItemWithStats` add client-computed stats.
- `ItemStatus`: instock, outofstock, reserved, onbackorder, lost, repairing, forsale, deleted (soft delete).
- Categories are stored as German strings (`GermanCategory`: Küche, Haushalt, Garten, Kinder, Freizeit, Heimwerken, Sonstige); `ItemCategory` is only an English-key mapping (`lib/constants/categories.ts`).
- `RentalStatus` (computed, never stored): active, returned, partially_returned, overdue, due_today, returned_today. `BookingStatus`: reserved, active, returned, overdue.
- `HighlightColor`: red, orange, yellow, green, teal, blue, purple, pink.
- Rentals: `items` (ids), `requested_copies` and `returned_items` (per item id copy counts, see `lib/utils/instance-data.ts`, `partial-returns.ts`), `rented_on`, `expected_on` (the due date; extending moves it), `extended_on` (when it was extended), `returned_on`.
- Status/label maps live in `lib/constants/statuses.ts`.

## Business Logic Helpers

- **Rental status**: `calculateRentalStatus(rental)` (`lib/utils/formatting.ts`, full rental object only). Returned (today) if `returned_on`; otherwise overdue / due today by `expected_on`; otherwise partially returned if some copies are back, else active. Overdue and due today win over partially returned.
- **Dates**: date-only fields are compared as calendar days in `BUSINESS_TIME_ZONE` (Europe/Berlin) via `toBusinessDay()`, independent of the browser's zone. Write date-only fields with `dateToLocalString(date)` (`YYYY-MM-DD`), never `toISOString()`; parse with `localStringToDate()`. Format with `formatDate` / `formatDateTime` (date-fns, German).
- **Overdue**: `lib/utils/overdue.ts` (`getOverdueSeverity`, thresholds, labels) is shared by the overdue page and the dashboard.
- **Availability**: an item can be rented if its status is `instock` or `reserved` and enough copies are free: `getMultipleItemAvailability(itemIds, excludeRentalId?)` (`lib/utils/item-availability.ts`) counts copies still out in unreturned rentals. It throws when it can't check; callers refuse the rental and say so (fail closed).
- **Rental templates**: `lib/utils/rental-template.ts` builds unsaved, prefilled rentals from reservations/bookings: `buildRentalTemplate`, `createRentalTemplate`, `getDefaultExpectedDate` (loan period from pickup or today), `calculateRentalDeposit` (deposit × copies).
- **Bookings**: `createBookings(data, count, copies)` (`lib/api/bookings.ts`) checks capacity with `assertBookingCapacity` and creates one record per copy all-or-nothing; conflicts throw `BookingConflictError` with a user-facing message. Capacity math in `lib/utils/booking-capacity.ts`, grid layout in `lib/utils/booking-grid.ts`.
- **New IDs**: `fetchNextIid(collections.items())` (`lib/utils/next-iid.ts`) = highest iid + 1; rethrows errors instead of guessing.
- **Highlight colours**: `lib/constants/colors.ts` is the single source for colour order, German names, customer/item meanings (`CUSTOMER_HIGHLIGHT_MEANINGS`, `ITEM_HIGHLIGHT_MEANINGS`, `describeHighlightColor`), filter options and Tailwind classes (`HIGHLIGHT_COLOR_CLASSES`, `getHighlightColorClasses`). The form help texts render the meanings from it. Never inline colour→class ternaries.

## UI Patterns

- **List pages** (customers, items, rentals, reservations, logs) are hand-built tables: `useFilters` (active filters persisted in localStorage per entity, filter string built server-side) with configs from `lib/filters/filter-configs.ts`, `useColumnVisibility` with `lib/tables/column-configs.ts` (also localStorage), search debounced 500 ms, infinite scroll in pages of 50 (`skipTotal`), a request-id guard that drops superseded responses, and realtime handlers that check `buildRecordInListFilter` before inserting/keeping a record.
- **Detail sheets** (`components/detail-sheets/`) handle view/create/edit. Forms: React Hook Form + `zodResolver` with the zod schema defined in the sheet. Help panels show `DOCUMENTATION` from `lib/constants/documentation.ts`.
- **Settings** (`/settings`, `useSettings()` from `hooks/use-settings.tsx`) are white-label settings stored in the PocketBase `settings` collection: branding (name, logo, favicon), appearance (primary colour, ID format/padding), features (reservations on/off, image compression for uploads), opening hours. `/setup` is the first-run wizard; `usePublicSettings()` serves the login page.
- Errors: user-facing German toasts via `sonner`, `console.error` for details; never show raw internal errors.
- Accessibility: label every control (German `aria-label`s), never convey state by colour alone, keep visible keyboard focus (see the focus rules in `app/globals.css`).
- Styling: Tailwind 4 + shadcn/ui, flat look (a global reset removes border radius and box shadows; `.crt-allow-shadow` exempts the system check).

## Testing

- Vitest (`vitest.config.ts`, mirrors the `@/` alias). Run `npx vitest run`.
- Tests live in `__tests__/` next to the module (`lib/utils/__tests__/…`, `hooks/__tests__/…`). Tests that need a DOM start with `// @vitest-environment jsdom` and use `@testing-library/react`; PocketBase is mocked with `vi.mock('@/lib/pocketbase/client', …)`.
- Focus on utilities, hooks and business rules (dates and time zones, status, availability, filters). There are no E2E tests.

## Conventions

- Files kebab-case (`rental-detail-sheet.tsx`), components PascalCase, types/interfaces PascalCase.
- Component files start with a short doc comment, then `'use client'`, imports, a props interface with documented props.
- Currency: EUR, German locale (`formatCurrency`).
- When the PocketBase schema changes: update `types/index.ts`, the accessors in `lib/pocketbase/client.ts`, forms/zod schemas and column/filter configs.
- New dashboard pages go under `app/(dashboard)/`; add navigation in `components/layout/navbar.tsx` (main links or the overflow menu).

## Troubleshooting

- Connection problems: check `localStorage.getItem('pocketbase_url')`, that PocketBase runs, and its CORS settings.
- Build issues: `rm -rf .next`.
