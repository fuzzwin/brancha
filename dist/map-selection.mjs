// Pele captures pointers on the zoom container, which retargets mouse clicks.
// Remember the original card and select it only when the gesture remains a tap.
export function bindMapPointerSelection(container, select) {
  let pressed = null;
  const down = event => {
    const node = event.target?.closest?.('.pele-node[data-id]');
    pressed = event.isPrimary !== false && event.button === 0 && node && container.contains(node)
      ? {id: node.getAttribute('data-id'), pointerId: event.pointerId, x: event.clientX, y: event.clientY}
      : null;
  };
  const moved = event => {
    if (pressed?.pointerId === event.pointerId && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 4) pressed = null;
  };
  const up = event => {
    const tap = pressed;
    pressed = null;
    if (tap?.pointerId === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 4) select(tap.id);
  };
  const cancel = () => { pressed = null; };
  const listeners = [['pointerdown', down], ['pointermove', moved], ['pointerup', up], ['pointercancel', cancel]];
  for (const [name, listener] of listeners) container.addEventListener(name, listener, true);
  return () => { cancel(); for (const [name, listener] of listeners) container.removeEventListener(name, listener, true); };
}
