# Testing status

Version 0.4. This page separates what was actually run from what is still open. It is not a conformance certification.

## Verified

- **Unit and regression tests (Vitest):** 72 tests. Data integrity, privacy guard, all LUT input combinations, multiplexer addresses,
  8-bit adder pairs, memory sequences, timers, reduced motion, focus handling during playback, invalid numeric input.
- **Build and dependencies:** production build succeeds; `npm audit --audit-level=high` reports no vulnerabilities at check time.
- **Accessibility (axe-core 4.14, local tool, not a dependency):** 96 combinations of simulation, view, theme and viewport (1280×800, 360×800).
  Only one rule fails, `label-content-name-mismatch` (WCAG 2.5.3, accessible name must contain the visible text) on SVG controls,
  in 42 of 96 cases. A fix is in the code (`nomeConTesto` in `src/main.js`) and has **not** been re-audited with axe yet.
  Colour contrast is reported as "incomplete" by axe in all cases and needs a manual check.
- **Colour pairs:** 36 CSS pairs checked against the declared thresholds.
- **Layout:** 48 checks on two representative nodes, five viewport sizes plus a narrow window, both themes and views:
  no horizontal overflow, no HTML control below 44×44 px.
- **Browsers:** built-in browser of the development environment (both views, focus, invalid input, legend);
  targeted check in Safari on desktop (LUT XOR, WebGL rendering, 2D→3D switch).
- **Performance (desktop, 1280×800):** `requestAnimationFrame` callbacks at 60/s over 2.5 s while zooming, no SVG nodes added or removed.
  This is callback cadence, not measured frames per second or GPU load.

## Still open

- Physical tablet: Chrome and Samsung Internet, both orientations, touch, pinch, pan, double tap, stylus; frame rate during pan and zoom.
- Screen readers and voice control; manual contrast checks; re-run of the axe audit after the label fix.
- Full pass of every simulation in Safari, and in Chrome and Firefox on desktop.
- Direct opening from `file://` (the app needs to be served over HTTP).
