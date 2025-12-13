KNOWN ISSUES TO FIX/IMPLEMENT

1. While markdown works in components/dashboard/dashboard-notes.tsx, headings are not visually distinct. i suspect a tailwind issue. make headings bigger and bold.

2. If a user uses the convert to rental feature in components/detail-sheets/reservation-detail-sheet.tsx, the reservation is marked as done regardless of if the rental was saved or not in the next step.

3. Using the convert to rental feature in components/dashboard/todays-reservations-section.tsx doesn't actually make a new rental with the customer items, but instead makes an empty rental. make sure these arguments pass correctly.