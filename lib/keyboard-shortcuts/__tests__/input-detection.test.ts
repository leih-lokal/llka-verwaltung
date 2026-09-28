// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { shouldIgnoreShortcutKey } from '../input-detection';

const key = (init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key: 'g', cancelable: true, ...init });

function mount(html: string): void {
  document.body.innerHTML = html;
}

function focus(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`no element for ${selector}`);
  el.focus();
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('shouldIgnoreShortcutKey', () => {
  it('lets keys through on a plain page button', () => {
    mount('<button id="b">x</button>');
    focus('#b');
    expect(shouldIgnoreShortcutKey(key())).toBe(false);
  });

  it('lets keys through with nothing focused', () => {
    expect(shouldIgnoreShortcutKey(key())).toBe(false);
  });

  it.each([
    ['input', '<input id="t" />'],
    ['textarea', '<textarea id="t"></textarea>'],
    ['select', '<select id="t"><option>a</option></select>'],
    ['contenteditable descendant', '<div contenteditable="true"><span id="t" tabindex="0">x</span></div>'],
  ])('ignores keys while typing in a %s', (_, html) => {
    mount(html);
    focus('#t');
    expect(shouldIgnoreShortcutKey(key())).toBe(true);
  });

  it.each([
    ['select trigger (combobox)', '<button id="t" role="combobox">Kategorie</button>'],
    ['menu item', '<div role="menu"><div id="t" role="menuitem" tabindex="-1">x</div></div>'],
    ['listbox option', '<div role="listbox"><div id="t" role="option" tabindex="-1">x</div></div>'],
    ['grid cell', '<div role="grid"><div role="row"><div id="t" role="gridcell" tabindex="0">x</div></div></div>'],
    ['tree item', '<ul role="tree"><li id="t" role="treeitem" tabindex="0">x</li></ul>'],
  ])('ignores keys inside a %s (type-ahead / navigation)', (_, html) => {
    mount(html);
    focus('#t');
    expect(shouldIgnoreShortcutKey(key())).toBe(true);
  });

  it('ignores keys while a dialog or sheet is open, even with focus outside it', () => {
    mount('<button id="b">x</button><div role="dialog" data-slot="sheet-content"></div>');
    focus('#b');
    expect(shouldIgnoreShortcutKey(key())).toBe(true);

    mount('<button id="b">x</button><div role="dialog" data-slot="dialog-content"></div>');
    focus('#b');
    expect(shouldIgnoreShortcutKey(key())).toBe(true);
  });

  it('does not treat a non-modal popover as a modal', () => {
    mount('<div role="dialog" data-state="open"><button id="b">x</button></div>');
    focus('#b');
    expect(shouldIgnoreShortcutKey(key())).toBe(false);
  });

  it('ignores auto-repeat (holding Shift must not count as double Shift)', () => {
    expect(shouldIgnoreShortcutKey(key({ key: 'Shift', repeat: true }))).toBe(true);
  });

  it('ignores keys another handler already consumed', () => {
    const event = key();
    event.preventDefault();
    expect(shouldIgnoreShortcutKey(event)).toBe(true);
  });
});
