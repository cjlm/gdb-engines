import assert from 'node:assert/strict';
import test from 'node:test';
import { hasModifierKey, isPlainPrimaryClick } from './plain-click.mjs';

const click = (overrides = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
});

test('an unmodified primary click is the page’s to handle', () => {
  assert.equal(isPlainPrimaryClick(click()), true);
  assert.equal(hasModifierKey(click()), false);
});

test('any modifier or another button leaves the click to the browser', () => {
  for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
    assert.equal(hasModifierKey(click({ [key]: true })), true, key);
    assert.equal(isPlainPrimaryClick(click({ [key]: true })), false, key);
  }
  assert.equal(isPlainPrimaryClick(click({ button: 1 })), false);
  assert.equal(isPlainPrimaryClick(click({ button: 2 })), false);
});
