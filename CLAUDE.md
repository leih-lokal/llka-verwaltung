# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LLKA-V** is a modern library/rental shop management system built with Next.js 16, React 19, and PocketBase. It manages customers, items (inventory), rentals, and reservations with a focus on performance, accessibility, and offline-first PWA capabilities.

## Development Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)

# Testing
npm run test            # Run unit tests with Vitest
npm run test:ui         # Run Vitest with UI
npm run test:coverage   # Generate test coverage report
npm run test:e2e        # Run Playwright E2E tests
npm run test:e2e:ui     # Run Playwright with UI

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Auto-fix ESLint errors
npm run type-check      # Run TypeScript type checking
```

**Note**: User handles building (`npm run build`) themselves - no need to build or type-check unless explicitly requested.

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript (strict mode)
- **Backend**: PocketBase (v0.26.x)
- **UI**: Shadcn/ui (Radix UI primitives) + Tailwind CSS 4
- **State**: React Context + Server Components (no global state library)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **PWA**: @ducanh2912/next-pwa
- **Drag & Drop**: @dnd-kit
- **Testing**: Vitest + Playwright

### Directory Structure

```
/app
  /(auth)/login           # Authentication route group
  /(dashboard)            # Main app route group
    /dashboard            # Dashboard with notes & stats
    /customers            # Customer CRUD
    /items                # Item CRUD
    /rentals              # Rental CRUD
    /reservations         # Reservation CRUD
    /settings             # API configuration
    /logs                 # Application logs
    layout.tsx            # Shared layout with navigation

/components
  /ui                     # Shadcn UI components
  /table                  # Data table components
  /layout                 # Navigation & header components
  /search                 # Search/command menu components

/lib
  /pocketbase             # PocketBase client & auth
  /constants              # Categories, statuses, colors
  /filters                # Filter utilities & configs
  /tables                 # Table column configs
  /utils                  # Utility functions & formatting

/hooks                    # Custom React hooks
  use-auth.ts             # Authentication state
  use-filters.ts          # Table filtering logic
  use-column-visibility.ts # Table column management
  use-command-menu.ts     # Command palette

/types
  index.ts                # All TypeScript types & interfaces

/public                   # Static assets
```

## PocketBase Integration

### Client Setup
- **Location**: `lib/pocketbase/client.ts`
- **Singleton pattern**: Use exported `pb` instance (Proxy-based)
- **URL management**: Supports dynamic PocketBase URL via localStorage
- **Collections**: Type-safe accessors via `collections` object

### Collections
```typescript
// Available collections
collections.customers()     // Customer records
collections.items()         // Item/inventory records
collections.rentals()       // Rental records
collections.reservations()  // Reservation records
collections.notes()         // Dashboard sticky notes
collections.logs()          // Application logs
```

### Authentication
```typescript
import { pb, isAuthenticated, getCurrentUser } from '@/lib/pocketbase/client';

// Login page stores PocketBase URL in localStorage
// URL can be different per user/environment
```

### Important Patterns
1. **Never hardcode PocketBase URL** - always use `getPocketBaseUrl()` or environment variables
2. **Type safety**: All collections have corresponding TypeScript types in `/types/index.ts`
3. **Error handling**: Wrap PocketBase calls in try-catch with appropriate error messages

## Type System

All types defined in `/types/index.ts`. Key interfaces:

### Core Entities
- `Customer` / `CustomerWithStats` / `CustomerFormData`
- `Item` / `ItemWithStats` / `ItemFormData`
- `Rental` / `RentalExpanded` / `RentalWithStatus`
- `Reservation` / `ReservationExpanded`
- `Note`, `LogEntry`, `Stats`

### Enums
- `ItemCategory`: kitchen, household, garden, kids, leisure, diy, other
- `ItemStatus`: instock, outofstock, reserved, lost, repairing, forsale, deleted
- `RentalStatus`: active, returned, overdue, due_today, returned_today
- `HighlightColor`: green, blue, yellow, red

### Patterns
- All records extend `BaseRecord` (id, created, updated)
- Use `iid` (integer ID) for user-facing IDs, `id` (string UUID) for internal references
- Expanded types (e.g., `RentalExpanded`) include populated relations via `expand` property
- Form data types separate from database types (e.g., `Date` vs `string`)

## Component Patterns

### Server vs Client Components
- **Default to Server Components** for static content, data fetching
- **Use Client Components** (`'use client'`) for:
  - Interactive forms
  - State management (useState, useContext)
  - Event handlers
  - Browser APIs (localStorage, etc.)
  - Hooks (useAuth, useFilters, etc.)

### Component Structure
```tsx
/**
 * Brief component description
 */
'use client'; // Only if needed

import { ... } from '...';

interface ComponentProps {
  /** Prop description */
  propName: string;
}

export function Component({ propName }: ComponentProps) {
  // Component logic
}
```

### Path Aliases
All imports use `@/` prefix:
```typescript
import { Customer } from '@/types';
import { pb } from '@/lib/pocketbase/client';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils/formatting';
```

## State Management

### Authentication
- **Hook**: `use-auth.ts` - provides authentication state and methods
- **Storage**: PocketBase authStore (persisted automatically)
- **URL Storage**: localStorage key `pocketbase_url`

### Table State
- **Hook**: `use-filters.ts` - manages search, filters, sorting, pagination
- **Pattern**: Combines URL search params for persistence
- **Features**: Debounced search (300ms), client-side filtering, server-side pagination

### Form State
- **Library**: React Hook Form
- **Validation**: Zod schemas (define inline or in validation files)
- **Pattern**:
  ```tsx
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ... }
  });
  ```

## Data Tables

Reusable data table system in `/components/table`:
- **Features**: Search, filtering, sorting, pagination, column visibility, row selection
- **Column configs**: Defined in `/lib/tables/column-configs.ts`
- **Filter configs**: Defined in `/lib/filters/filter-configs.ts`
- **Color coding**: Rows can be color-coded based on business logic (e.g., overdue rentals = red)

## Business Logic

### Rental Status Computation
Rentals don't have a status field - it's computed from dates:
- `returned_on` exists → returned/returned_today
- No `returned_on` + past `expected_on` → overdue
- No `returned_on` + `expected_on` is today → due_today
- No `returned_on` + future `expected_on` → active

### Item Availability
Items can be rented if:
- `status === 'instock'`
- Not currently in an active rental
- Not soft-deleted

### Color Highlighting
Both customers and items support `highlight_color` (green/blue/yellow/red) for visual attention in tables.

## Important Conventions

### Naming
- Components: PascalCase (`CustomerForm.tsx`)
- Files: kebab-case (`use-filters.ts`)
- Types/Interfaces: PascalCase (`Customer`, `ItemFormData`)
- Enums: PascalCase keys (`ItemCategory.Kitchen`)

### Formatting
- **Dates**: Use `date-fns` (in `lib/utils/formatting.ts`)
- **Currency**: EUR with German locale
- **IDs**: Display `iid` to users, use `id` in code

### Error Handling
- Always show user-friendly error messages via toast notifications (Sonner)
- Log errors to console in development
- Never expose internal errors to users

### Accessibility
- All interactive elements have ARIA labels
- Forms have associated labels
- Color is never the only indicator (use icons/text too)
- Keyboard navigation supported (focus visible, tab order)

## Key Files to Check

When working on specific features, check these files:

### Authentication
- `app/(auth)/login/page.tsx` - Login form with PocketBase URL input
- `lib/pocketbase/auth.ts` - Auth utilities
- `hooks/use-auth.ts` - Auth state management

### CRUD Operations
- Check `/lib/filters/filter-configs.ts` for available filters
- Check `/lib/tables/column-configs.ts` for table columns
- Check `/types/index.ts` for data structure

### Utilities
- `lib/utils/formatting.ts` - Date, currency, text formatting
- `lib/utils/index.ts` - General utilities (cn, etc.)
- `lib/constants/*` - Categories, statuses, colors

## Testing

### Unit Tests (Vitest)
- Focus on utilities, hooks, and business logic
- Located next to source files or in `__tests__`
- Use `@testing-library/react` for component tests

### E2E Tests (Playwright)
- Test critical user flows
- Located in `tests/` or `e2e/`
- Run against development server

### Coverage Goals
- Utilities: 80%+
- Components: 60%+
- E2E: Critical paths covered

## PWA & Offline

- **Configuration**: `next-pwa` in `next.config.ts`
- **Service Worker**: Auto-generated, caches static assets
- **Manifest**: `/public/manifest.json` with app metadata
- **Strategy**: Network-first for API, cache-first for static assets

## Common Tasks

### Adding a New Page
1. Create route in `/app/(dashboard)/route-name/page.tsx`
2. Add navigation link in `/components/layout/nav.tsx`
3. Define types in `/types/index.ts` if needed
4. Create API functions in `/lib/api/` if needed

### Adding a New Form
1. Define form data type in `/types/index.ts`
2. Create Zod schema for validation
3. Use React Hook Form with zodResolver
4. Use Shadcn form components (form, input, select, etc.)

### Adding a New Table
1. Define columns in `/lib/tables/column-configs.ts`
2. Define filters in `/lib/filters/filter-configs.ts`
3. Use `use-filters` hook for state management
4. Implement data fetching with PocketBase

### Modifying PocketBase Schema
1. Update types in `/types/index.ts`
2. Update collection accessors in `/lib/pocketbase/client.ts`
3. Update forms and validation schemas
4. Update table columns if displayed

## Troubleshooting

### PocketBase Connection Issues
- Check `localStorage.getItem('pocketbase_url')` in browser console
- Verify PocketBase server is running (`./pocketbase serve`)
- Check CORS settings in PocketBase

### Type Errors
- Run `npm run type-check` for detailed errors
- Check that types in `/types/index.ts` match PocketBase schema
- Verify path aliases are configured in `tsconfig.json`

### Build Issues
- Clear `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Next.js version compatibility

## Migration Context

This project is a rewrite from Svelte 3 → Next.js 15 (see PLAN.md for details). Key differences:
- Uses Next.js App Router (not Pages Router)
- Server Components by default (different from client-only Svelte)
- PocketBase backend remains unchanged (same schema)
- Modern React patterns (hooks, not class components)

## References

- [Next.js 15 Docs](https://nextjs.org/docs) - App Router, Server Components
- [Shadcn/ui](https://ui.shadcn.com) - Component library
- [PocketBase Docs](https://pocketbase.io/docs/) - Backend API
- [React Hook Form](https://react-hook-form.com) - Form handling
- [Zod](https://zod.dev) - Schema validation
