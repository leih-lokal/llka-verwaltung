# KEY FILES REFERENCE GUIDE

## Core Data Fetching Files

### Main CRUD Pages (All 'use client' components)
1. **Customers List** - `/home/user/llka-verwaltung/app/(dashboard)/customers/page.tsx`
   - Lines 110-118: `collections.customers().getList()` call
   - Lines 98-144: `fetchCustomers()` function
   - Lines 209-214: Save callback resets & refetches

2. **Items List** - `/home/user/llka-verwaltung/app/(dashboard)/items/page.tsx`
   - Lines 112-120: `collections.items().getList()` call
   - Lines 100-140: `fetchItems()` function
   - Lines 205-210: Save callback resets & refetches

3. **Rentals List** - `/home/user/llka-verwaltung/app/(dashboard)/rentals/page.tsx`
   - Lines 114-123: `collections.rentals().getList()` with expand
   - Lines 102-143: `fetchRentals()` function
   - Lines 208-213: Save callback resets & refetches

4. **Reservations List** - `/home/user/llka-verwaltung/app/(dashboard)/reservations/page.tsx`
   - Lines 143-152: `collections.reservations().getList()` with expand
   - Lines 131-172: `fetchReservations()` function
   - Lines 240-246: Save callback resets & refetches

5. **Dashboard** - `/home/user/llka-verwaltung/app/(dashboard)/dashboard/page.tsx`
   - Lines 30-41: `fetchStats()` with error handling
   - Lines 43-47: Manual refresh clears cache

### PocketBase Configuration
- **Client Setup** - `/home/user/llka-verwaltung/lib/pocketbase/client.ts`
  - Lines 50-58: `createPocketBaseClient()` function
  - Lines 67-76: `getPocketBaseClient()` with URL checking
  - Lines 82-88: Proxy-based singleton pattern
  - Lines 93-101: `collections` accessor object

- **Authentication** - `/home/user/llka-verwaltung/lib/pocketbase/auth.ts`
  - Lines 81-123: `setupAutoRefresh()` interval function (10 min)
  - Lines 63-75: `refreshAuth()` token refresh
  - Lines 107-114: Auth change listener setup

## Dashboard Components

### Notes - `/home/user/llka-verwaltung/components/dashboard/dashboard-notes.tsx`
- Lines 133-146: `loadNotes()` using `getFullList()`
- Lines 188-210: `handleSaveNote()` with reload
- Lines 212-223: `handleDeleteNote()` with reload
- Lines 148-172: Drag-and-drop reorder with `collections.notes().update()`

### Active Rentals - `/home/user/llka-verwaltung/components/dashboard/active-rentals-section.tsx`
- Lines 32-72: `loadRentals()` with filter `returned_on = ""`
- Lines 35-39: Fetches active rentals only
- No refresh mechanism beyond initial load

### Today's Reservations - `/home/user/llka-verwaltung/components/dashboard/todays-reservations-section.tsx`
- Lines 33-55: `loadReservations()` with date filter
- Lines 44: Dynamic date filter for today
- Lines 75-90: Mark as done (calls API but doesn't refresh parent)

### Stats - `/home/user/llka-verwaltung/lib/api/stats.ts`
- Lines 24-25: `CACHE_KEY` and `CACHE_TTL = 1 hour`
- Lines 41-57: `fetchStats()` with cache check
- Lines 62-85: `getCachedStats()` with TTL validation
- Lines 114-117: `clearStatsCache()` manual refresh

## State Management Hooks

### Filters Hook - `/home/user/llka-verwaltung/hooks/use-filters.ts`
- Lines 23-55: `useFilters()` hook definition
- Lines 31-43: localStorage load on mount
- Lines 45-54: localStorage persist on change
- Lines 92-147: `buildFilter()` converts to PocketBase syntax

### Column Visibility - `/home/user/llka-verwaltung/hooks/use-column-visibility.ts`
- Similar pattern to useFilters for column preferences

### Authentication - `/home/user/llka-verwaltung/hooks/use-auth.ts`
- Lines 44-66: Auth state initialization
- Lines 58-60: Auth store listener setup

## Detail Sheets (Components)

### Customer Detail Sheet - `/home/user/llka-verwaltung/components/detail-sheets/customer-detail-sheet.tsx`
- Lines 100+: Form handling and save logic (file continues beyond line 100)
- Pattern: onSave callback triggers parent list refresh

### Item Detail Sheet - `/home/user/llka-verwaltung/components/detail-sheets/item-detail-sheet.tsx`
- Similar save/refresh pattern as customer detail sheet

### Rental Detail Sheet - `/home/user/llka-verwaltung/components/detail-sheets/rental-detail-sheet.tsx`
- Pattern: onSave callback triggers parent list refresh

### Reservation Detail Sheet - `/home/user/llka-verwaltung/components/detail-sheets/reservation-detail-sheet.tsx`
- Pattern: onSave callback triggers parent list refresh

## Utility Functions

### Formatting - `/home/user/llka-verwaltung/lib/utils/formatting.ts`
- `calculateRentalStatus()` - Computed status from dates
- `formatDate()`, `formatDateTime()` - Display formatting
- Used in all list & detail pages

### Customer Stats - `/home/user/llka-verwaltung/lib/utils/customer-stats.ts`
- `enrichCustomersWithStats()` - Extra API calls for rental counts
- Called in customers page after main fetch (performance concern)

### Filter Utils - `/home/user/llka-verwaltung/lib/filters/filter-utils.ts`
- `buildPocketBaseFilter()` - Converts filters to PocketBase syntax
- `generateFilterId()` - Creates filter IDs

## Filter & Table Configuration

### Filter Configs - `/home/user/llka-verwaltung/lib/filters/filter-configs.ts`
- `customersFilterConfig`, `itemsFilterConfig`, etc.
- Defines available filters per entity

### Column Configs - `/home/user/llka-verwaltung/lib/tables/column-configs.ts`
- Column definitions, sort fields, visibility defaults

---

## CRITICAL CODE PATTERNS TO UNDERSTAND

### List Refresh Pattern (All CRUD Pages):
```typescript
// In page component
const handleSave = (savedItem) => {
  setItems([]);              // Clear state
  setCurrentPage(1);         // Reset pagination
  fetchItems(1);             // Refetch everything
};
```
**Impact**: Loses scroll position, filter state resets to page 1

### Infinite Scroll Pattern:
```typescript
// IntersectionObserver at bottom of list
useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore && !isLoading) {
      fetchItems(currentPage);  // Load next page, append to state
    }
  });
  // ...
});
```

### No Real-Time Updates:
- No `pb.collection().subscribe()` calls
- No WebSocket listeners
- Changes from other users not reflected until manual refresh

### Dashboard Components Load Independently:
```typescript
// Each component has its own useEffect + loadFunction
useEffect(() => {
  loadRentals();
  loadReservations();  
  loadNotes();
}, []);
// All three load on initial render, no coordination
```

---

## WHAT'S MISSING (For Real-Time Subscriptions)

No code exists for:
1. PocketBase real-time subscriptions (`pb.collection().subscribe()`)
2. WebSocket connection management
3. Automatic cache invalidation
4. Optimistic updates
5. Conflict resolution for concurrent edits
6. Connection state indicators
7. Automatic reconnection logic
8. Change event broadcasting across components

