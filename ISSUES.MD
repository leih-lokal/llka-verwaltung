KNOWN ISSUES TO FIX

components/detail-sheets/reservation-detail-sheet.tsx:
  - converting reservation to a rental using the convert button should also mark the reservation as complete

components/detail-sheets/customer-detail-sheet.tsx:
  - prevent items with any status other than reserved/preordered and available from showing up. if they show up regardless, throw an error toast on save, saying the item in question is not available.

components/detail-sheets/rental-detail-sheet.tsx:
  - display the phone number in a reasonable format for easy copying

app/(dashboard)/rentals/page.tsx
  - increase visibility of the colour casts for overdue/returned/due today but don't make them too garish
  - filtering by status doesn't work at all, it throws a 400 error. pocketbase logs say: invalid left operand "__computed_status__" - unknown field "__computed_status__"
  - remove the # sign from customer IDs and apply the same styling to item IDs that you find in app/(dashboard)/items/page.tsx

components/layout/navbar.tsx
  - make the inactive tabs more prominent, increase their contrast and font size maybe.
