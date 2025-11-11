# Feature Backlog

This document tracks future enhancements and features that have been identified but not yet implemented.

---

## Implementation Note

**Instanced Items Feature** is now live using the `requested_copies` JSON field in the rental collection.
Copy counts are stored as: `{"item_id": count}` and automatically tracked for availability.

---

## Partial Returns for Instanced Items

**Priority:** Medium
**Complexity:** High
**Status:** Not Started

### Description

Allow customers to return only some copies of a multi-copy rental while keeping the rest. The system should split the rental into two separate records: one for returned copies and one for copies still rented.

### Example Scenario

1. Customer rents 3 copies of item #3414 (drill bits)
2. After one week, customer returns 2 copies but keeps 1
3. System creates:
   - **Rental A** (original): 2 copies, marked as returned
   - **Rental B** (new): 1 copy, still active with updated expected return date

### Current Limitation

The current implementation requires all copies in a rental to be returned together. There is no way to return a subset of copies.

### Requirements

#### User Interface
- Add "Partial Return" button in rental detail sheet (next to "Return" button)
- Show dialog allowing user to specify:
  - How many copies are being returned
  - How many copies are being kept
  - New expected return date for remaining copies (optional)
- Display clear confirmation message showing the split

#### Data Handling
- **Rental Split Logic:**
  - Update original rental with returned copies count
  - Create new rental for remaining copies with same customer and item
  - Link rentals via new `parent_rental_id` field (requires DB schema change)
  - Preserve all original rental metadata (employee, rented_on, etc.)

- **Deposit Calculation:**
  - Calculate proportional deposits: `deposit_per_copy = total_deposit / total_copies`
  - Original rental: `deposit_returned_copies = deposit_per_copy × returned_copies`
  - New rental: `deposit_remaining_copies = deposit_per_copy × remaining_copies`
  - Handle edge cases where deposits don't divide evenly

- **Copy Count Data:**
  - Update `requested_copies` JSON field in both rental records
  - Ensure copy counts are accurate in both records

#### Backend Changes
- Modify `updateItems()` in `rental.js` to handle partial returns
- Add transaction support to ensure atomic rental splits
- Update item availability calculations to account for split rentals

#### Edge Cases to Handle
1. **Lost/Damaged Copies:** Some returned copies are damaged
   - Allow different `deposit_back` amounts for returned vs. remaining
   - Add notes field to document condition

2. **All Copies Lost:** Customer wants to report all copies lost without returning
   - Mark rental as "lost" without creating split
   - Adjust deposit_back accordingly

3. **Multiple Partial Returns:** Customer returns in multiple batches
   - Support chaining: Rental A → Rental B → Rental C
   - Display rental history/lineage in UI

4. **Concurrent Edits:** Staff tries to modify rental during split
   - Implement optimistic locking or conflict resolution

### Technical Considerations

#### Database Schema Changes (Optional)
While the current implementation works without schema changes, partial returns would benefit from:
- `parent_rental_id` field to link split rentals
- `split_from_rental_id` field to track the original rental
- `is_partial_return` boolean flag

Note: Copy counts are already tracked in the `requested_copies` JSON field.

#### UI/UX Design

**Partial Return Dialog:**
```
┌────────────────────────────────────────────────┐
│ Teilrückgabe                                   │
├────────────────────────────────────────────────┤
│ Gegenstand: #3414 - Bohrbit Set               │
│ Anzahl ausgeliehen: 3                         │
│                                                │
│ Anzahl zurückgeben: [2] (1-3)                 │
│ Anzahl behalten:    1                          │
│                                                │
│ Neue Rückgabedatum: [DD.MM.YYYY] (Optional)   │
│                                                │
│ Kaution:                                       │
│ - Pro Exemplar: €10.00                        │
│ - Zurückgegeben: €20.00 (2×)                  │
│ - Behalten: €10.00 (1×)                       │
│                                                │
│         [Abbrechen]  [Bestätigen]              │
└────────────────────────────────────────────────┘
```

**Rental History View:**
```
Leihvorgang #42 (Original)
├─ 3 Exemplare ausgeliehen am 01.01.2024
├─ 2 Exemplare zurückgegeben am 08.01.2024 → Leihvorgang #43
└─ Status: Teilweise zurückgegeben

Leihvorgang #43 (Abgespalten von #42)
├─ 1 Exemplar noch ausgeliehen
└─ Erwartete Rückgabe: 15.01.2024
```

### Testing Checklist

- [ ] Split rental with equal deposit distribution
- [ ] Split rental with unequal deposits (e.g., damaged items)
- [ ] Multiple sequential splits (A → B → C)
- [ ] Return all remaining copies from split rental
- [ ] Verify item availability updates correctly
- [ ] Check rental history/lineage display
- [ ] Validate deposit calculations are accurate
- [ ] Test with single-copy items (should disable partial return)
- [ ] Edge case: Try to return more copies than rented

### Implementation Steps

1. **Phase 1: UI & Validation**
   - Add "Partial Return" button (conditional on copy count > 1)
   - Create partial return dialog component
   - Implement client-side validation

2. **Phase 2: Data Layer**
   - Modify rental create/update logic for splits
   - Implement deposit calculation helpers
   - Update instance data handling

3. **Phase 3: Backend Integration**
   - Extend `updateItems()` in rental.js
   - Add transaction support for atomic splits
   - Test with PocketBase hooks

4. **Phase 4: History & Reporting**
   - Display rental lineage in detail sheet
   - Update CSV export to show split rentals
   - Add filters for split/partial rentals

5. **Phase 5: Testing & Documentation**
   - Comprehensive testing of all scenarios
   - Update user documentation
   - Train staff on partial returns workflow

### Related Issues

- None yet

### Notes

- Consider whether partial returns should be restricted to certain item types
- May want to add audit logging for rental splits
- Could integrate with email notifications to customer about partial return
- Discuss with team: should partial returns affect customer statistics?

---

## Future Ideas (Unplanned)

### Item Reservation System Enhancements
- Allow reserving specific copies (not just item types)
- Notify customers when specific copy becomes available

### Rental Extensions
- Allow extending only some copies in a multi-copy rental
- Implement automatic extension reminders

### Batch Operations
- Return multiple rentals at once
- Rent multiple copies of different items in one transaction (already supported, but could improve UX)

---

**Last Updated:** 2024-11-11
**Maintained By:** Development Team
