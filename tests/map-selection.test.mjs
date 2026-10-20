import test from 'node:test';
import assert from 'node:assert/strict';
import {bindMapPointerSelection} from '../dist/map-selection.mjs';

function harness() {
  const listeners = new Map(), selected = [], node = {getAttribute: () => 'card1'};
  const container = {contains: n => n === node, addEventListener: (n, f) => listeners.set(n, f), removeEventListener: n => listeners.delete(n)};
  const target = {closest: () => node}, outside = {closest: () => null};
  const dispose = bindMapPointerSelection(container, id => selected.push(id));
  const send = (type, extra = {}) => listeners.get(type)?.({pointerId: 1, clientX: 10, clientY: 10, button: 0, isPrimary: true, target, ...extra});
  return {selected, send, outside, dispose, listeners};
}

test('a card tap selects the original card when zoom retargets pointerup to the container', () => {
  const h = harness();
  h.send('pointerdown');h.send('pointerup', {target: h.outside, clientX: 12});
  assert.deepEqual(h.selected, ['card1']);
  h.send('pointerup');assert.equal(h.selected.length, 1);
});

test('panning, pinch, cancelled gestures and background clicks do not select cards', () => {
  const h = harness();
  h.send('pointerdown');h.send('pointermove', {clientX: 30});h.send('pointerup');
  h.send('pointerdown');h.send('pointerdown', {pointerId: 2, isPrimary: false});h.send('pointerup');
  h.send('pointerdown');h.send('pointercancel');h.send('pointerup');
  h.send('pointerdown', {target: h.outside});h.send('pointerup');
  h.send('pointerdown', {button: 2});h.send('pointerup');
  assert.deepEqual(h.selected, []);
  h.dispose();assert.equal(h.listeners.size, 0);
});
