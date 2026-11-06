# Testing status

Version 0.4. This page separates what was actually run from what is still open. It is not a conformance certification.

## Verified

- **Unit and regression tests (Vitest):** 72 tests. Data integrity, privacy guard, all LUT input combinations, multiplexer addresses,
  8-bit adder pairs, memory sequences, timers, reduced motion, focus handling during playback, invalid numeric input.
- **Build and dependencies:** production build succeeds; `npm audit --audit-level=high` reports no vulnerabilities at check time.
- **Accessibility (axe-core 4.14, local tool, not a dependency):** 96 combinations of simulation, view, theme and viewport (1280×800, 360×800).
  Only one rule fails, `label-content-name-mismatch` (WCAG 2.5.3, accessible name must contain the visible text) on SVG controls,
  in 42 of 96 cases. The fix (`nomeConTesto` in `src/render2d/index.ts`) was re-audited on the production build with axe-core 4.14:
  0 violations of that rule and of five related rules (`color-contrast`, `aria-allowed-role`, `aria-valid-attr-value`, `button-name`,
  `scrollable-region-focusable`) in 30 runs (2D: 8 nodes × Explanation/Try tabs; 3D: 7 nodes × the same tabs; one theme, desktop viewport).
  The full 96-combination audit was not repeated.
  Colour contrast is reported as "incomplete" by axe in all cases and needs a manual check.
- **Colour pairs:** 36 CSS pairs checked against the declared thresholds.
- **Layout:** 48 checks on two representative nodes, five viewport sizes plus a narrow window, both themes and views:
  no horizontal overflow, no HTML control below 44×44 px.
- **Browsers:** built-in browser of the development environment (both views, focus, invalid input, legend);
  targeted check in Safari on desktop (LUT XOR, WebGL rendering, 2D→3D switch).
- **Performance (desktop, 1280×800):** `requestAnimationFrame` callbacks at 60/s over 2.5 s while zooming, no SVG nodes added or removed.
  This is callback cadence, not measured frames per second or GPU load.

## TypeScript refactor regression checks

- All 72 existing tests pass; only their import extensions changed. Strict typecheck, production build and dependency audit pass.
- Initial production browser checks in both views: Board-to-LUT navigation, LUT XOR, BRAM write, theme changes and view switching with node/variant preservation; no console errors observed.
- At 1280×800, all 13 roots match the baseline DOM in each view (SVG/panel in 2D; labels/panel, scene nodes and mesh counts in 3D). The two slice screenshots match byte for byte.
- Data, styles and CSP configuration are unchanged. Runtime imports have no cycles. The existing privacy test does not scan TypeScript; the same term check was separately applied to every TypeScript source.
- Additional production UI regression at 372×718: all twelve simulations in both views (24 cases), with reset in every case. Checked LUT/MUX outputs, FF/latch traces, RAM writes, marked shifts, carry sums, BRAM writes, pin conflicts, routing, clock division, JTAG/bitstream and design-flow steps. Playback completion passed for FF/latch, carry, clock and bitstream; invalid input was checked for carry, BRAM and clock. No console errors were observed.
- These checks do not re-audit accessibility or establish equivalence for every viewport, theme, control and input sequence.

## Pending checks

Unchecked items remain unverified and are not acceptance claims.

- [ ] Extend the automated privacy guard to TypeScript and verify that it rejects a prohibited term in a TypeScript source. The existing test remains unchanged under the refactor's import-only test constraint; the current sources passed a separate manual scan.
- [x] Run a representative production UI regression for all twelve simulations in both views, with reset, playback completion and invalid-input cases as detailed above. Exhaustive interaction coverage remains outside this check.
- [ ] Test a physical tablet: Chrome and Samsung Internet, both orientations, touch, pinch, pan, double tap, stylus; measure frame rate during pan and zoom.
- [ ] Repeat the full axe audit (both themes, narrow viewport), check contrast manually, and test screen readers and voice control.
- [ ] Run every simulation in Safari, Chrome and Firefox on desktop.
- [ ] Run the GitHub workflow after a separately authorized integration. Local checks do not establish the remote CI result.

Direct opening from `file://` remains untested; local verification uses an HTTP server.
