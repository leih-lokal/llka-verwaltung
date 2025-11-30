KNOWN ISSUES TO FIX/IMPLEMENT

1. Using websocket connections, on any screen, when a reservation is added to the reservation collection with the "on_premises" boolean set to true, immediately show a large (non-blocking) notification including its details, not just a toast. the notification should come with a sound to catch attention. these are important reservations created using a self-service terminal on the premises. this also includes reservations that were changed from on_premises false to on_premises true, as those users are using the terminal to pick up their order.

2. make the OTP field also prominent in the components/detail-sheets/reservation-detail-sheet.tsx.

3. make the OTP prominent in the current reservations field in app/(dashboard)/dashboard/page.tsx.

4. make the OTP prominent in the printed list of reservations invoked from the dashboard section.

5. in app/(dashboard)/reservations/page.tsx, add a button to immediately mark as done and convert to rental as a column, with a button (with an icon) in that column.
