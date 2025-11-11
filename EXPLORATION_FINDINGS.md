# Next.js Implementation Analysis: Data Fetching, State Management & Refresh Mechanisms

## 1. DATA FETCHING PATTERNS

### Current Architecture: Client-Side Data Fetching
All main CRUD pages are **'use client'** components that handle their own data fetching:
- **Customers page** (`app/(dashboard)/customers/page.tsx`)
- **Items page** (`app/(dashboard)/items/page.tsx`)
- **Rentals page** (`app/(dashboard)/rentals/page.tsx`)
- **Reservations page** (`app/(dashboard)/reservations/page.tsx`)
- **Dashboard page** (`app/(dashboard)/dashboard/page.tsx`)

### Fetch Locations:
1. **List pages** - Use `collections.<entity>().getList()` for paginated data
   - Location: Page components (useCallback fetchFunctions)
   - Pattern: Server-side filtering, sorting, pagination via PocketBase query parameters
   
2. **Detail views** - Use `collections.<entity>().getOne()` for single record
   - Location: URL query parameters trigger loads (e.g., `?view=id`)
   - Pattern: Expanded relations fetched on demand (e.g., `expand: 'customer,items'`)
   
3. **Dashboard components** - Specialized fetching patterns
   - `DashboardNotes` → `collections.notes().getFullList()`
   - `ActiveRentalsSection` → `collections.rentals().getFullList()` with filter `returned_on = ""`
   - `TodaysReservationsSection` → `collections.reservations().getFullList()` with date filter
   - Stats → Custom API endpoint `pb.send('/api/stats')`

### PocketBase Client Setup
- **Location**: `lib/pocketbase/client.ts`
- **Pattern**: Proxy-based singleton that respects URL changes
- **Collections accessed via**: `collections.customers()`, `collections.items()`, etc.
- **Authentication**: Automatic via localStorage persistence

---

## 2. CURRENT REFRESH MECHANISMS

### Manual Refresh Patterns
All pages use manual, on-demand refresh triggered by user actions:

#### CRUD Pages (Customers, Items, Rentals, Reservations):
1. **After save/delete** - `onSave` callback in detail sheets
   - Resets state: `setCustomers([])`, `setCurrentPage(1)`
   - Re-fetches with: `fetchCustomers(1)`
   
2. **Manual operations** - Save/delete triggers a full list refresh
   - Location: `handleCustomerSave()`, `handleItemSave()`, etc.
   - Impact: Entire list reloads, loses scroll position

#### Dashboard Components:
1. **Notes** - Manual load on mount + create/edit/delete
   - `loadNotes()` called on: mount, save, delete
   - Reorders via drag-and-drop with immediate API updates
   
2. **Active Rentals** - One-time load on mount
   - No refresh mechanism currently implemented
   - `onRentalReturned` callback passed but not used
   
3. **Today's Reservations** - One-time load on mount
   - No automatic refresh after marking as done
   - `onReservationCompleted` callback passed from parent
   
4. **Stats Chart** - Cached with 1-hour TTL
   - Location: `lib/api/stats.ts`
   - Cache strategy: `localStorage` with `CACHE_KEY = 'dashboard_stats_cache'`
   - Manual refresh: `handleRefreshStats()` clears cache + refetches

---

## 3. STATE MANAGEMENT FOR COLLECTIONS

### State Organization Pattern
Each page uses independent local state:
```typescript
const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [error, setError] = useState<string | null>(null);
const [currentPage, setCurrentPage] = useState(1);
const [hasMore, setHasMore] = useState(true);
const [searchQuery, setSearchQuery] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');
```

### Derived State & Hooks:
1. **Filters** - `useFilters()` hook in `hooks/use-filters.ts`
   - Persists to localStorage per entity
   - Converts to PocketBase filter strings
   - Manages active filters, filter popover state
   
2. **Column Visibility** - `useColumnVisibility()` hook
   - Persists column preferences to localStorage
   - Allows toggling/resetting columns per entity
   
3. **Sort/Pagination** - Local state managed in pages
   - Sort field & direction: `sortField`, `sortColumn`
   - Pagination: `currentPage`, `hasMore`, `perPage=50`

### No Global State Management
- No Redux, Zustand, or Context API for shared data
- No server-side session state
- No real-time subscription to PocketBase changes

---

## 4. CLIENT VS SERVER COMPONENT USAGE

### Client Components (All CRUD Pages):
- **Reason**: Interactive forms, state management, infinite scroll, filtering
- Pages: customers, items, rentals, reservations
- Dashboard: all sections are client components

### Server Components:
- **Not used for data display** - Auth guard via middleware
- **Potential candidates**: Layout components, static sections

### Layout Structure:
```
app/
├── layout.tsx (root server component)
├── (auth)/
│   └── login/page.tsx (client component for form)
└── (dashboard)/
    ├── layout.tsx (client component with nav)
    ├── customers/page.tsx (client - full list)
    ├── items/page.tsx (client - full list)
    ├── rentals/page.tsx (client - full list)
    ├── reservations/page.tsx (client - full list)
    └── dashboard/page.tsx (client - hub component)
```

---

## 5. EXISTING POLLING/REFRESH MECHANISMS

### NO AUTOMATIC POLLING
The application currently has:
- **No WebSocket subscriptions** to PocketBase collections
- **No polling intervals** for list pages
- **No real-time updates** on shared data changes

### Manual Triggers Only:
1. URL parameters (`?action=new`, `?view=id`) trigger single fetches
2. Search/filter changes trigger list refreshes
3. Infinite scroll triggers pagination load
4. Detail sheet save/delete triggers parent refresh
5. Manual refresh button on stats (clears cache)

### Authentication Refresh:
- **Location**: `lib/pocketbase/auth.ts`
- **Pattern**: `setupAutoRefresh()` interval every 10 minutes
- **Scope**: Token refresh only, not data

---

## 6. DATA FLOW DIAGRAM

### Simple Example: Customer CRUD
```
User clicks "New Customer"
↓
CustomerDetailSheet opens with isNewCustomer=true
↓
User fills form & clicks "Save"
↓
Detail sheet: collections.customers().create(data)
↓
Detail sheet calls onSave() callback with saved customer
↓
Page: handleCustomerSave() called
↓
Reset state: setCustomers([]), setCurrentPage(1)
↓
Fetch fresh list: fetchCustomers(1)
↓
Display updated list
```

### Refresh Pattern Flow:
```
Page mount
↓
Load initial data (page 1)
↓
Render with loading state
↓
User interacts (search, filter, scroll, save)
↓
If search/filter/sort: reset to page 1 & refetch
↓
If infinite scroll: load next page & append
↓
If save/delete: reset list & refetch all
```

---

## 7. KEY UTILITY FUNCTIONS

### From `lib/filters/filter-utils.ts`:
- `buildPocketBaseFilter(filters, searchQuery)` - Converts active filters to PocketBase syntax
- `generateFilterId(filter)` - Creates unique filter IDs

### From `lib/utils/formatting.ts`:
- `calculateRentalStatus()` - Computed status from dates
- `formatDate()`, `formatDateTime()` - Date display
- Imported in all pages for display formatting

### From `lib/utils/customer-stats.ts`:
- `enrichCustomersWithStats()` - Fetches rental counts per customer
- Called after main list fetch, adds latency

---

## 8. DASHBOARD STATS STRATEGY

### Implementation:
```typescript
// lib/api/stats.ts
const CACHE_KEY = 'dashboard_stats_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchStats() {
  const cached = getCachedStats();
  if (cached) return cached;
  
  const data = await pb.send('/api/stats', { method: 'GET' });
  setCachedStats(data);
  return data;
}

export function clearStatsCache() {
  localStorage.removeItem(CACHE_KEY);
}
```

### Cache Behavior:
- Responses cached for 1 hour
- Manual refresh available on dashboard
- No automatic invalidation on data changes

---

## 9. CRITICAL LIMITATIONS

### Performance Issues:
1. **Customer stats** - Extra API call per customer after list fetch
2. **Full list reloads** - Save/delete causes entire list refresh (loses scroll, filters reset position)
3. **No cache invalidation** - Manual refresh only

### User Experience Issues:
1. **Stale data** - Changes from other users not reflected automatically
2. **Dashboard lag** - Three independent component loads on dashboard
3. **No optimistic updates** - Full refresh required for feedback

### Scalability Issues:
1. **No lazy loading** - All notes loaded on dashboard
2. **No real-time sync** - Requires manual refresh between users
3. **Connection-dependent** - No offline support or queue

---

## 10. NEXT.JS / REACT PATTERNS USED

### Hooks:
- `useState` - Local state (lists, loading, errors)
- `useEffect` - Side effects (initialization, dependency tracking)
- `useCallback` - Function memoization (fetch functions)
- `useRef` - DOM references (infinite scroll observer)
- `useMemo` - Value memoization (date calculations)
- Custom hooks: `useFilters`, `useColumnVisibility`, `useAuth`

### Data Fetching:
- Direct PocketBase client calls in useCallback
- No Next.js API routes
- No Server Components for data fetching
- No incremental static regeneration (ISR)

### Navigation:
- `useRouter`, `useSearchParams` from 'next/navigation'
- URL parameters for deep linking (`?view=id`, `?action=new`)
- Manual router.replace() to clear params after load

### Libraries:
- `react-hook-form` + `zod` for form validation
- `sonner` for toast notifications
- `@dnd-kit` for drag-and-drop (notes reordering)
- `recharts` for stats visualization
- `date-fns` for date handling

---

