KNOWN ISSUES TO FIX

components/detail-sheets/rental-detail-sheet.tsx
  - the system checks if items are set to available or reserved and then filters them in the item selection dialogue, or throws an error if the user tries to save and circumvent. this already works. however, returning that rental won't save because of this logic. 
    possible solutions:
      - skip the check on return
      - make the return button force save the dialogue
    