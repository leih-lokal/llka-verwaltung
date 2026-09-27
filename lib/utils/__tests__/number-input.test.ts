import { describe, it, expect } from 'vitest';
import { clampNumberInput } from '../number-input';

describe('clampNumberInput', () => {
  it('keeps values inside the range', () => {
    expect(clampNumberInput('1200', 64, 8192, 1600)).toBe(1200);
  });

  it('clamps to the bounds', () => {
    expect(clampNumberInput('1', 64, 8192, 1600)).toBe(64);
    expect(clampNumberInput('99999', 64, 8192, 1600)).toBe(8192);
    expect(clampNumberInput('-5', 0, Infinity, 200)).toBe(0);
  });

  it('rounds to whole numbers', () => {
    expect(clampNumberInput('82.6', 1, 100, 82)).toBe(83);
  });

  it('falls back to the last value for empty or invalid text', () => {
    expect(clampNumberInput('', 1, 100, 82)).toBe(82);
    expect(clampNumberInput('  ', 1, 100, 82)).toBe(82);
    expect(clampNumberInput('abc', 1, 100, 82)).toBe(82);
  });
});
