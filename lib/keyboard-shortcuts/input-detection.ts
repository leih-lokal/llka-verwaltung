/**
 * Utility to determine if keyboard shortcuts should be disabled
 * based on current focus state
 */

/**
 * Determines if an input field or text area is currently focused
 * Prevents keyboard shortcuts from firing when user is typing
 *
 * Checks for:
 * - INPUT, TEXTAREA and SELECT elements
 * - Elements inside a contenteditable region
 * - Elements with role="textbox" (ARIA)
 *
 * @returns true if an input is focused, false otherwise
 */
export function isInputFocused(): boolean {
  const activeElement = document.activeElement;

  if (!activeElement) {
    return false;
  }

  const tagName = activeElement.tagName;

  // Check for standard input/textarea/select elements (select has type-ahead)
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  // Check for contenteditable elements (and anything inside one).
  // contenteditable can be "true", "" (empty string), or "plaintext-only"
  if (activeElement.closest('[contenteditable]:not([contenteditable="false"])')) {
    return true;
  }

  // Check for ARIA textbox role
  if (activeElement.getAttribute('role') === 'textbox') {
    return true;
  }

  return false;
}

/**
 * Composite widgets that handle printable keys themselves: type-ahead in
 * listboxes, menus and select/combobox triggers, and arrow/letter
 * navigation in grids and trees.
 */
const KEY_CONSUMING_WIDGET_SELECTOR = [
  '[role="listbox"]',
  '[role="option"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="combobox"]',
  '[role="grid"]',
  '[role="treegrid"]',
  '[role="tree"]',
].join(', ');

/**
 * Present in the DOM while a modal dialog or sheet is open. Radix doesn't
 * set aria-modal, so the shadcn wrappers' data-slot markers are matched too
 * (Radix unmounts the content once it has closed).
 */
const OPEN_MODAL_SELECTOR = [
  '[aria-modal="true"]',
  '[role="alertdialog"]',
  '[data-slot="dialog-content"]',
  '[data-slot="sheet-content"]',
].join(', ');

/**
 * True if focus is inside a widget that uses printable keys itself.
 */
export function isKeyConsumingWidgetFocused(): boolean {
  const activeElement = document.activeElement;
  return !!activeElement?.closest(KEY_CONSUMING_WIDGET_SELECTOR);
}

/**
 * True if a modal dialog or sheet is currently open.
 */
export function isModalOpen(): boolean {
  return document.querySelector(OPEN_MODAL_SELECTOR) !== null;
}

/**
 * Whether a global single-key shortcut (letter sequences, "/", double
 * Shift) should ignore this keydown: something already handled it, it's an
 * auto-repeat or IME composition, the user is typing, focus is in a widget
 * with its own key handling, or a modal dialog/sheet is open.
 */
export function shouldIgnoreShortcutKey(event: KeyboardEvent): boolean {
  return (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    isInputFocused() ||
    isKeyConsumingWidgetFocused() ||
    isModalOpen()
  );
}
