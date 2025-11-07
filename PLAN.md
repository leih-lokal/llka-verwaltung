# Migration Plan: Svelte V3 → Next.js 15
## LeihLokal Verwaltung - Library Management System

## Executive Summary
Recreate the "LeihLokal Verwaltung" (German library/rental shop management system) in Next.js 15 with focus on:
- **Performance & Speed**: Faster load times, better caching, optimized rendering
- **Better UX/UI Design**: Modern Shadcn/ui components, improved mobile support, enhanced accessibility

## Original System Analysis

### Technology Stack (Old)
- **Frontend**: Svelte 3.42.4
- **Backend**: PocketBase 0.26.2
- **Routing**: svelte-spa-router
- **Build**: Rollup
- **Charts**: svelte-chartjs
- **PWA**: Custom service worker

### Core Functionality
The system manages a lending library with 4 main entities:

1. **Customers (Nutzer:innen)**
   - Personal info (name, address, contact)
   - Membership tracking (registered, renewed dates)
   - Newsletter preferences
   - Color highlighting for attention
   - Active rental count tracking

2. **Items (Gegenstände)**
   - Item details (name, brand, model, category)
   - Multi-category support (Kitchen, Household, Garden, Kids, Leisure, DIY, Other)
   - Image uploads
   - Status tracking (available, rented, reserved, lost, repairing, for sale, not lendable)
   - Deposit amounts
   - Synonyms for search
   - Soft delete capability

3. **Rentals (Leihvorgänge)**
   - Customer-item linkage
   - Date tracking (rented, expected return, extended, actual return)
   - Deposit management (given, returned)
   - Employee tracking (checkout/return)
   - Color coding (returned=green, due=blue, overdue=red)
   - Smart notifications

4. **Reservations (Reservierungen)**
   - Multi-item reservations
   - Pickup appointments
   - Support for new customers (not yet registered)
   - Completion tracking

5. **Dashboard (Start)**
   - Drag-and-drop color-coded sticky notes
   - Statistics charts:
     - Active customers (last 3 months)
     - Total rentals over time
     - New customers per month
     - Total inventory items

6. **Additional Features**
   - Data export to CSV
   - Application logs viewer
   - API configuration settings
   - Real-time data subscriptions
   - Offline PWA capability

---

## New Technology Stack

### Core Technologies
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **UI Framework**: Shadcn/ui + Tailwind CSS + Radix UI primitives
- **Backend**: PocketBase 0.26.2 (keep existing)
- **PWA**: next-pwa
- **State Management**: React Context + Server Components
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Date Handling**: date-fns
- **Notifications**: Sonner
- **Drag & Drop**: dnd-kit
- **Testing**: Vitest + Playwright

### Architecture Decisions

#### Why Next.js 15 App Router?
- Server Components for better performance
- Built-in routing with layouts
- API routes for server actions
- Image optimization out of the box
- Better SEO capabilities

#### Why Shadcn/ui?
- Accessible by default (Radix UI primitives)
- Customizable with Tailwind
- Copy-paste component model (not a dependency)
- Consistent design system
- Excellent mobile support

#### Why Keep PocketBase?
- Already set up and working
- Real-time subscriptions
- File upload support
- Authentication built-in
- Minimal migration effort

---

## Implementation Phases

## Phase 1: Project Foundation (Sprint 1)

### 1.1 Setup Next.js Project
- [x] Initialize Next.js 15 with TypeScript
- [ ] Install and configure Tailwind CSS
- [ ] Setup Shadcn/ui with custom theme
- [ ] Configure custom blue theme (#008cba)
- [ ] Setup ESLint + Prettier
- [ ] Configure path aliases (@/components, @/lib, etc.)

### 1.2 Install Dependencies
```bash
# Core
npm install pocketbase date-fns zod react-hook-form @hookform/resolvers

# UI & Interactions
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select
npm install sonner @dnd-kit/core @dnd-kit/sortable recharts lucide-react

# PWA
npm install next-pwa

# Dev Dependencies
npm install -D vitest @testing-library/react @playwright/test
```

### 1.3 Project Structure
```
/app
  /(auth)
    /login
      page.tsx              # Login page
  /(dashboard)
    layout.tsx              # Main app layout with navigation
    /dashboard
      page.tsx              # Dashboard with notes & stats
    /customers
      page.tsx              # Customer list
      /[id]
        page.tsx            # Customer detail/edit
    /items
      page.tsx              # Item list
      /[id]
        page.tsx            # Item detail/edit
    /rentals
      page.tsx              # Rental list
      /[id]
        page.tsx            # Rental detail/edit
    /reservations
      page.tsx              # Reservation list
      /[id]
        page.tsx            # Reservation detail/edit
    /settings
      page.tsx              # API configuration
    /logs
      page.tsx              # Application logs

/components
  /ui                       # Shadcn components
  /tables
    data-table.tsx          # Reusable table component
    data-table-toolbar.tsx  # Search, filters, actions
    data-table-pagination.tsx
  /forms
    customer-form.tsx
    item-form.tsx
    rental-form.tsx
    reservation-form.tsx
  /layout
    nav.tsx                 # Navigation sidebar
    header.tsx              # Top header
    user-menu.tsx
  /dashboard
    note-board.tsx          # Drag-drop notes
    stats-charts.tsx        # Statistics charts

/lib
  /pocketbase
    client.ts               # PocketBase client singleton
    auth.ts                 # Authentication utilities
    types.ts                # Generated/manual types
  /api
    customers.ts            # Customer API functions
    items.ts                # Item API functions
    rentals.ts              # Rental API functions
    reservations.ts         # Reservation API functions
    notes.ts                # Notes API functions
    stats.ts                # Statistics API functions
  /hooks
    use-customers.ts
    use-items.ts
    use-rentals.ts
    use-reservations.ts
    use-auth.ts
  /utils
    validation.ts           # Zod schemas
    formatting.ts           # Date, currency formatting
    filters.ts              # Filter builders
    export.ts               # CSV export
  /constants
    categories.ts           # Item categories
    statuses.ts             # Item/rental statuses
    colors.ts               # Highlight colors

/public
  /icons
  manifest.json
  service-worker.js

/types
  index.ts                  # Global type definitions
```

### 1.4 Type Definitions
Create TypeScript interfaces for all entities:
- Customer
- Item
- Rental
- Reservation
- Note
- Stats
- Filter/Sort types
- API response types

### 1.5 PocketBase Client Setup
- Create singleton client instance
- Authentication helper functions
- Type-safe collection access
- Error handling wrapper
- Real-time subscription utilities

### 1.6 Base Layout & Navigation
- Main app layout with sidebar
- Responsive navigation (mobile drawer)
- User menu with logout
- Route protection middleware
- Loading states

---

## Phase 2: Core Features - Data Tables (Sprint 2-3)

### 2.1 Reusable Table System
Build a powerful, reusable table component system:

**Features:**
- Server-side pagination
- Client-side search with debounce (300ms)
- Advanced filtering UI
  - Dropdown filters (status, category)
  - Date range pickers
  - Multi-select filters
- Column sorting (single & multi-column)
- Row selection
- Row actions (edit, delete, view)
- Color-coded rows based on business logic
- Export to CSV
- Mobile-responsive (card view on mobile)
- Loading skeletons
- Empty states
- Error states

**Components:**
```tsx
<DataTable
  columns={columns}
  data={data}
  pagination={pagination}
  onPaginationChange={setPagination}
  filters={filters}
  onFilterChange={setFilters}
  sorting={sorting}
  onSortingChange={setSorting}
  searchColumn="name"
  onExport={exportToCSV}
/>
```

### 2.2 Customer Management (/customers)

**List View:**
- Columns: ID, Name, Email, Phone, City, Active Rentals, Total Rentals, Registered, Actions
- Color highlighting (green, blue, yellow, red)
- Search by: name, email, city, phone
- Filters: active/inactive, newsletter subscriber, registered date range
- Sort by: name, registered date, rental count

**Create/Edit Modal:**
```tsx
<CustomerForm
  customer={customer}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

**Fields:**
- First name, Last name (required)
- Email, Phone
- Street, Postal code, City
- Registered on, Renewed on (date pickers)
- How did you hear about us? (select)
- Newsletter subscription (checkbox)
- Remarks (textarea)
- Highlight color (color picker)

**Validation (Zod):**
- Email format
- Required fields
- Unique customer ID (auto-generated)

**Features:**
- Auto-increment customer ID
- Duplicate check
- Show active rentals inline
- Quick actions: View rentals, Create rental, Edit, Delete
- Real-time updates (PocketBase subscription)

### 2.3 Item Management (/items)

**List View:**
- Columns: ID, Image, Name, Brand, Category, Status, Deposit, Rental Count, Actions
- Status badges with colors
- Image thumbnails
- Search by: name, brand, model, synonyms
- Filters: status, category, has deposit, deleted items
- Sort by: name, rental count, added date

**Create/Edit Modal:**
```tsx
<ItemForm
  item={item}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

**Fields:**
- Name (required), Brand, Model
- Description (textarea)
- Categories (multi-select): Kitchen, Household, Garden, Kids, Leisure, DIY, Other
- Deposit amount (number)
- Status (select): in stock, rented, reserved, lost, repairing, for sale, not lendable
- Images (upload with preview, multiple)
- Synonyms (tag input)
- Packaging details, Manual, Parts list
- Number of copies
- Highlight color
- Internal note (only visible to staff)

**Image Upload:**
- Next.js Image component for optimization
- Multiple image support
- Drag-and-drop upload
- Image preview before upload
- Delete images
- First image as thumbnail

**Features:**
- Auto-increment item ID
- Soft delete (mark as deleted, not actually remove)
- Restore deleted items
- Availability indicator (auto-update from rentals)
- Show rental history
- Quick actions: View rentals, Create rental, Edit, Delete/Restore

### 2.4 Rental Management (/rentals)

**List View:**
- Color-coded rows:
  - 🟢 Green: Returned today
  - 🔵 Blue: Due today
  - 🔴 Red: Overdue
  - ⚪ White: Active, not due yet
- Columns: Customer, Items, Rented On, Expected Return, Actual Return, Status, Deposit, Actions
- Search by: customer name, item name
- Filters: active/returned, overdue, date range, employee
- Sort by: rented date, expected return date

**Create Rental Flow:**
```tsx
<RentalForm
  rental={rental}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

**Steps:**
1. Select customer (autocomplete with search)
2. Select items (autocomplete, multiple)
   - Show item status
   - Warn if item is already rented
   - Show customer's active rentals
3. Set dates:
   - Rented on (default: today)
   - Expected return (default: +7 days)
4. Set deposit
   - Auto-populate from item deposits
   - Allow manual override
5. Add remarks
6. Set employee (current user)

**Return Rental Flow:**
```tsx
<ReturnRentalModal
  rental={rental}
  onReturn={handleReturn}
/>
```

**Fields:**
- Return date (default: today)
- Deposit returned amount
- Return employee (current user)
- Remarks

**Features:**
- Smart notifications:
  - "Customer has X active rentals"
  - "Item is currently rented by [Name]"
  - "Customer last rented on [Date]"
- Extend rental (update expected_on date)
- Partial returns (some items returned, some still out)
- Automatic status calculation
- Email reminder for overdue (future feature)
- Real-time updates

### 2.5 Reservation Management (/reservations)

**List View:**
- Columns: Customer, Items, Pickup Date, Created, Status, Actions
- Filter: done/pending, date range
- Sort by: pickup date, created date

**Create Reservation:**
```tsx
<ReservationForm
  reservation={reservation}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

**Fields:**
- Customer selection (existing or new)
  - For new: Name, Phone, Email
- Items (multi-select with autocomplete)
- Pickup date/time
- Comments
- Is new customer? (checkbox)

**Features:**
- Mark as done (completed)
- Convert to rental (when customer picks up)
- Cancel reservation
- Notify customer (future feature)
- Item availability check

---

## Phase 3: Dashboard & Analytics (Sprint 4)

### 3.1 Dashboard Layout (/dashboard)

**Grid Layout:**
```
┌─────────────────────────────────────┐
│  Statistics Charts (top row)        │
├──────────────┬──────────────────────┤
│ Active       │ Total Rentals        │
│ Customers    │ Over Time            │
├──────────────┼──────────────────────┤
│ New          │ Total                │
│ Customers    │ Inventory            │
├──────────────┴──────────────────────┤
│  Sticky Notes Board (bottom)        │
│  (drag & drop, color-coded)         │
└─────────────────────────────────────┘
```

### 3.2 Sticky Notes System

**Features:**
- Create notes with color selection (yellow, pink, blue, green, purple, orange)
- Rich text editor (simple: bold, italic, lists)
- Drag-and-drop reordering (dnd-kit)
- Delete notes
- Persist order in PocketBase
- Auto-save on edit
- Timestamps (created, updated)

**Component:**
```tsx
<NoteBoard
  notes={notes}
  onCreateNote={handleCreate}
  onUpdateNote={handleUpdate}
  onDeleteNote={handleDelete}
  onReorder={handleReorder}
/>
```

### 3.3 Statistics Charts (Recharts)

**Chart 1: Active Customers (Last 3 Months)**
- Line chart
- X-axis: Months
- Y-axis: Count
- Definition: Customers who rented at least once in the last 3 months

**Chart 2: Total Rentals Over Time**
- Bar chart
- X-axis: Months (last 12 months)
- Y-axis: Rental count
- Stacked: Active vs Returned

**Chart 3: New Customers Per Month**
- Area chart
- X-axis: Months (last 12 months)
- Y-axis: New registrations

**Chart 4: Total Inventory**
- Donut chart
- Segments: By category
- Center: Total count

**Data Source:**
- Use PocketBase `getStats()` API
- Aggregate from views (item_rentals, customer_rentals)
- Cache with React Query (5-minute stale time)

---

## Phase 4: Advanced Features (Sprint 5)

### 4.1 Authentication

**Login Page (/login):**
- Email/username input
- Password input
- "Remember me" checkbox
- Error messages
- Redirect to dashboard on success

**Protected Routes:**
- Middleware to check authentication
- Redirect to /login if not authenticated
- Store token in httpOnly cookie (if possible) or localStorage

**Session Management:**
- Auto-refresh token before expiration
- Logout functionality
- Session timeout warning

### 4.2 Settings (/settings)

**API Configuration:**
- PocketBase URL
- Admin username
- Admin password
- Test connection button
- Save to localStorage (encrypted if possible)

**App Settings:**
- Language (DE/EN) - future
- Theme (Light/Dark) - future
- Notifications enabled
- Default rental period (days)

### 4.3 Logs (/logs)

**Log Viewer:**
- Table of application logs
- Columns: Timestamp, Level, Message, User, Action
- Filters: Level (info, warn, error), Date range, User
- Search by message
- Export to CSV

**Logged Events:**
- CRUD operations (create, update, delete)
- Authentication events (login, logout)
- Errors (API failures, validation errors)
- Important business events (rental created, item returned)

**Implementation:**
- Log to PocketBase collection
- Client-side logger wrapper
- Automatic user/timestamp capture

### 4.4 PWA Enhancement

**Service Worker (next-pwa):**
- Cache API responses
- Offline page
- Background sync for failed requests
- Cache-first strategy for static assets
- Network-first for API calls with cache fallback

**Manifest:**
```json
{
  "name": "LeihLokal Verwaltung",
  "short_name": "LeihLokal",
  "description": "Library Management System",
  "theme_color": "#008cba",
  "background_color": "#ffffff",
  "display": "standalone",
  "orientation": "portrait",
  "scope": "/",
  "start_url": "/dashboard",
  "icons": [...]
}
```

**Install Prompt:**
- Detect if installable
- Show custom install banner
- "Add to Home Screen" button in settings

**Offline Handling:**
- Show offline indicator
- Queue mutations when offline
- Sync when back online
- Optimistic UI updates

---

## Phase 5: UX/Performance Improvements (Sprint 6)

### 5.1 Performance Optimizations

**React Server Components:**
- Use Server Components for static content
- Client Components only for interactivity
- Reduce JavaScript bundle size

**Dynamic Imports:**
```tsx
const CustomerForm = dynamic(() => import('@/components/forms/customer-form'))
const StatsCharts = dynamic(() => import('@/components/dashboard/stats-charts'))
```

**Image Optimization:**
- Use Next.js Image component everywhere
- Lazy loading
- Responsive images
- WebP format with fallbacks

**Route Prefetching:**
- Prefetch links on hover
- Preload critical data

**Optimistic UI:**
- Update UI immediately on mutations
- Revert on error
- Show loading states

**React.memo:**
- Memoize table rows
- Memoize expensive components
- Use useMemo/useCallback appropriately

**Caching Strategy:**
- React Query for server state
- Aggressive caching with smart invalidation
- Background refetching

### 5.2 UX Enhancements

**Toast Notifications (Sonner):**
- Success: "Customer created successfully"
- Error: "Failed to save rental"
- Info: "Exporting data..."
- Loading: "Saving..." → "Saved!"

**Loading States:**
- Skeleton loaders for tables
- Spinner for forms
- Progress bars for uploads
- Shimmer effects

**Error Boundaries:**
- Catch component errors
- Graceful fallback UI
- Error reporting
- Reset functionality

**Keyboard Shortcuts:**
- `Ctrl+K`: Global search
- `Ctrl+N`: New item (context-aware)
- `Ctrl+S`: Save form
- `Esc`: Close modal
- `Alt+1-5`: Navigate to sections

**Mobile Navigation:**
- Bottom navigation bar on mobile
- Collapsible sidebar on tablet
- Swipe gestures
- Touch-friendly hit areas (min 44px)

**Accessibility:**
- ARIA labels on all interactive elements
- Keyboard navigation (tab order)
- Focus visible styles
- Screen reader announcements
- Color contrast (WCAG AA)
- Alt text for images
- Form labels associated with inputs

**Empty States:**
- Illustrations or icons
- Helpful text: "No customers yet. Create your first customer!"
- Primary action button

**Confirmation Dialogs:**
- Delete actions
- Destructive actions
- Unsaved changes warning

**Autocomplete Improvements:**
- Show recent selections
- Fuzzy search
- Keyboard navigation
- Create new option inline

---

## Phase 6: Testing & Deployment (Sprint 7)

### 6.1 Testing

**Unit Tests (Vitest):**
- Utility functions (formatting, validation, filters)
- Custom hooks
- API client functions
- Zod schemas

**Component Tests (@testing-library/react):**
- Form validation
- Table sorting/filtering
- Modal interactions
- Button click handlers

**Integration Tests:**
- Full CRUD flows
- Authentication flow
- API client with mock PocketBase

**E2E Tests (Playwright):**
- Critical paths:
  - Login → Create customer → Create rental → Return rental
  - Create item with images
  - Dashboard loads correctly
  - Export to CSV works
  - Offline mode works
- Mobile viewport tests
- Cross-browser (Chrome, Firefox, Safari)

**Coverage Goals:**
- Utilities: 80%+
- Components: 60%+
- E2E: Critical paths covered

### 6.2 Build Optimization

**Production Build:**
```bash
npm run build
```

**Checks:**
- Bundle size analysis (next-bundle-analyzer)
- Lighthouse score (90+ on all metrics)
- Zero console errors
- No accessibility violations (axe-core)

**Optimizations:**
- Code splitting
- Tree shaking
- Minification
- Compression (gzip/brotli)
- Remove unused CSS (PurgeCSS built into Tailwind)

### 6.3 Deployment

**Environment Setup:**
- `.env.production` with PocketBase URL
- Separate PocketBase instances for dev/staging/prod
- Database backup strategy

**Hosting Options:**
- Vercel (recommended for Next.js)
- Netlify
- Self-hosted with Docker

**PocketBase Connection:**
- Update API URL to production endpoint
- CORS configuration
- SSL/HTTPS required

**PWA Testing:**
- Install on devices
- Offline functionality verification
- Push notification testing (if added)

**Performance Audit:**
- Lighthouse CI in pipeline
- Web Vitals monitoring
- Error tracking (Sentry optional)

**Documentation:**
- Deployment guide
- Environment variable reference
- Troubleshooting guide
- User manual updates

---

## Key Improvements Over Original

### Performance
- ✅ Server Components reduce JavaScript bundle
- ✅ Next.js Image optimization (automatic WebP, lazy loading)
- ✅ Better caching strategy with React Query
- ✅ Code splitting with dynamic imports
- ✅ Route prefetching
- ✅ Optimistic UI updates

### UX/UI
- ✅ Modern Shadcn/ui components (consistent, accessible)
- ✅ Better mobile responsiveness
- ✅ Loading skeletons and states
- ✅ Toast notifications instead of alerts
- ✅ Improved error handling
- ✅ Keyboard shortcuts
- ✅ Better autocomplete UX
- ✅ Empty states with helpful messaging
- ✅ Confirmation dialogs for destructive actions

### Developer Experience
- ✅ Full TypeScript coverage (type safety)
- ✅ Better folder structure (feature-based)
- ✅ Reusable component library
- ✅ Custom hooks for business logic
- ✅ Zod validation (type-safe, reusable)
- ✅ Comprehensive testing setup
- ✅ Better error handling

### Accessibility
- ✅ WCAG 2.1 AA compliance
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Focus management
- ✅ ARIA labels
- ✅ Better color contrast

### Maintainability
- ✅ Clear separation of concerns
- ✅ Reusable utilities and hooks
- ✅ Type-safe API layer
- ✅ Standardized form handling
- ✅ Consistent error handling
- ✅ Code documentation

### PWA
- ✅ Modern service worker (next-pwa)
- ✅ Better offline handling
- ✅ Background sync
- ✅ Install prompt
- ✅ Optimistic updates

---

## Migration Notes

### What Stays the Same
- ✅ PocketBase backend (no migration needed)
- ✅ Database schema (customers, items, rentals, reservations, notes)
- ✅ Core business logic
- ✅ User workflows
- ✅ PWA capability

### What Changes
- 🔄 Svelte 3 → React 19 (component rewrite)
- 🔄 Rollup → Next.js bundler
- 🔄 Chart.js → Recharts
- 🔄 dayjs → date-fns
- 🔄 Custom table → Shadcn data table
- 🔄 Custom forms → React Hook Form + Zod
- 🔄 Custom autocomplete → Shadcn Combobox
- 🔄 Custom modal → Radix Dialog

### Breaking Changes
- ⚠️ No real-time subscriptions initially (can add later)
- ⚠️ Different URL structure (/customers vs /start#customers)
- ⚠️ New login UI

### Data Migration
- ✅ No data migration needed (same PocketBase backend)
- ✅ Users keep their credentials
- ✅ All historical data preserved

---

## Timeline Estimate

### Sprint Breakdown
| Sprint | Phase | Duration | Deliverables |
|--------|-------|----------|--------------|
| 1 | Foundation | 1 week | Project setup, types, PocketBase client, base layout |
| 2 | Tables | 1 week | Reusable table system, customer management |
| 3 | CRUD | 1 week | Items, rentals, reservations management |
| 4 | Dashboard | 1 week | Notes board, statistics charts |
| 5 | Advanced | 1 week | Auth, settings, logs, PWA |
| 6 | Polish | 1 week | Performance, UX improvements, accessibility |
| 7 | Testing & Deploy | 1 week | Tests, optimization, deployment |

### Milestones
- **Week 1**: Foundation complete, can navigate between pages
- **Week 2**: Can view and manage customers
- **Week 3**: Can manage all entities (MVP feature parity)
- **Week 4**: Dashboard working, nice-to-have features
- **Week 5**: Full feature parity with old app
- **Week 6**: Polished, performant, accessible
- **Week 7**: Tested, deployed, production-ready

### Total Timeline
- **MVP (Feature Parity)**: 3-4 weeks
- **Polished Product**: 6 weeks
- **Production Ready**: 7 weeks

---

## Risk Mitigation

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| PocketBase API changes | High | Pin version, test thoroughly |
| Real-time subscriptions complex | Medium | Start without, add later if needed |
| Image upload performance | Medium | Use Next.js Image, lazy loading |
| PWA complexity | Medium | Use next-pwa, test incrementally |
| TypeScript learning curve | Low | Strong typing from start, leverage IDE |

### Project Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep | High | Stick to plan, defer nice-to-haves |
| Underestimated complexity | Medium | Buffer time in each sprint |
| Design inconsistency | Low | Use Shadcn design system |
| Testing time | Medium | Test continuously, not at end |

---

## Success Criteria

### Functional
- ✅ All original features work
- ✅ Data imports/exports correctly
- ✅ Authentication works
- ✅ PWA installs and works offline
- ✅ No data loss on CRUD operations

### Performance
- ✅ Lighthouse score: 90+ on all metrics
- ✅ First Contentful Paint: < 1.5s
- ✅ Time to Interactive: < 3s
- ✅ Bundle size: < 500KB initial load

### UX
- ✅ Mobile-friendly (touch targets, responsive)
- ✅ Accessible (WCAG 2.1 AA)
- ✅ Loading states everywhere
- ✅ Clear error messages
- ✅ Intuitive navigation

### Code Quality
- ✅ TypeScript strict mode, zero errors
- ✅ ESLint zero errors
- ✅ Test coverage: 70%+
- ✅ No console errors in production
- ✅ Documented code

---

## Future Enhancements (Post-MVP)

### Phase 8+
- Multi-language support (German/English)
- Dark mode
- Email notifications (overdue reminders)
- SMS notifications
- Barcode scanning for items
- QR code rental cards
- Advanced reporting (revenue, popular items)
- Calendar view for rentals
- Automated late fees
- Integration with payment systems
- Mobile app (React Native?)
- Admin role management
- Public catalog view (for customers)
- Online reservation system (customer-facing)
- Inventory management (stock levels, reordering)

---

## Resources

### Documentation
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Shadcn/ui](https://ui.shadcn.com)
- [PocketBase JS SDK](https://github.com/pocketbase/js-sdk)
- [Radix UI](https://www.radix-ui.com)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)
- [Recharts](https://recharts.org)

### Tools
- [Next.js Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [axe DevTools](https://www.deque.com/axe/devtools/)

---

## Appendix

### Color System
- **Primary**: #008cba (blue)
- **Highlight Colors**: Green, Blue, Yellow, Red
- **Status Colors**:
  - Green: Success, returned today
  - Blue: Info, due today
  - Red: Error, overdue
  - Yellow: Warning
  - Gray: Neutral, inactive

### Item Categories
1. Kitchen (Küche)
2. Household (Haushalt)
3. Garden (Garten)
4. Kids (Kinder)
5. Leisure (Freizeit)
6. DIY (Heimwerken)
7. Other (Sonstiges)

### Item Statuses
- `instock`: Available for rental
- `outofstock`: Currently rented
- `reserved`: Reserved by customer
- `onbackorder`: Ordered but not yet available
- `lost`: Item lost/missing
- `repairing`: Under repair
- `forsale`: For sale, not for rent
- `deleted`: Soft-deleted

### Rental Statuses (computed)
- `active`: Not yet returned
- `returned`: Returned on time
- `overdue`: Past expected return date
- `due_today`: Expected return is today
- `returned_today`: Returned today

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Author**: Claude (with Ruby)
**Status**: Approved ✅
