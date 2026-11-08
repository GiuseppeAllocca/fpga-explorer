# Testing status

Version 0.4. This page separates what was actually run from what is still open. It is not a conformance certification.

## Historical verification

The results in this section predate the slice follow-up below.

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
- Data, styles and CSP configuration were unchanged by the refactor. Runtime imports had no cycles. The privacy guard was subsequently extended to scan TypeScript sources; the separate manual scan was part of the earlier refactor check.
- Additional production UI regression at 372×718: all twelve simulations in both views (24 cases), with reset in every case. Checked LUT/MUX outputs, FF/latch traces, RAM writes, marked shifts, carry sums, BRAM writes, pin conflicts, routing, clock division, JTAG/bitstream and design-flow steps. Playback completion passed for FF/latch, carry, clock and bitstream; invalid input was checked for carry, BRAM and clock. No console errors were observed.
- These checks do not re-audit accessibility or establish equivalence for every viewport, theme, control and input sequence.

## 2D slice follow-up (2026-11-08)

- Strict typecheck, all 72 existing tests, production build, dependency audit and `git diff --check` pass locally. The public data file retains its approved SHA-256 hash.
- Production HTTP checks at 1280×800 and 360×800, both themes and SLICEL/SLICEM: initial view, Fit and zoom (24 states). DOM bounds and rendered wire paths show no text overlaps or wire/text crossings in these states; all six routes still terminate at their intended symbols. Multiplexer-name clearance from the routes increases from 5.3 to 19.3 CSS px in the initial desktop view. This measures geometry, not learning speed.
- All six route controls pass mouse, Enter, visible-focus and Escape checks across the eight viewport/theme/variant combinations. Explicit SVG hit rectangles and HTML buttons retain at least 44×44 CSS px in the measured states; individual resource surfaces are smaller in the distant overview and remain reachable through zoom, keyboard navigation and the panel.
- Targeted MUX output/highlight checks (40 states), small-MUX transitions, FF/latch output/configuration, carry propagation, invalid carry input and reset pass across the same combinations.
- Non-slice SVG and panel markup match the baseline for all twelve other roots at 1280×800/light. The unchanged 3D renderer also matches labels, panels, scene-node lists and mesh counts for all thirteen roots in a representative SLICEM/light run.
- A new axe-core 4.14.0 check on the initial slice/Explanation state passes with 0 violations across the eight combinations. The same tool reproduced Label in Name failures on the baseline; the slice fix separates SVG text, avoids parenthetical-only label additions and updates hidden FF/latch notes. `color-contrast` and `label-content-name-mismatch` still have incomplete results. This is not the full 96-combination audit or a manual accessibility review.
- Build total: 793,567 → 794,947 bytes (+0.174%); deterministic gzip: 210,034 → 210,321 bytes (+0.137%). The Three.js chunk is byte-identical and retains its existing size warning. CSP is preserved; the targeted 2D runs load no 3D chunk.
- The published baseline's [CI](https://github.com/GiuseppeAllocca/fpga-explorer/actions/runs/42268156165) and [Pages deployment](https://github.com/GiuseppeAllocca/fpga-explorer/actions/runs/42313735137) were confirmed successful. These remote results do not validate subsequent local changes.

## Pending checks

Unchecked items remain unverified and are not acceptance claims.

- [x] Add a negative check demonstrating rejection of a prohibited term in a TypeScript source. The same predicate used by the real scan rejects injected prohibited contents for a TypeScript path found by the repository walker, and accepts clean contents. No fixture files are written. All 73 tests pass; the prohibited-term pattern, file extensions and exclusions are unchanged.
- [x] Run a representative production UI regression for all twelve simulations in both views, with reset, playback completion and invalid-input cases as detailed above. Exhaustive interaction coverage remains outside this check.
- [ ] Test a physical tablet: Chrome and Samsung Internet, both orientations, touch, pinch, pan, double tap, stylus; measure frame rate during pan and zoom.
- [ ] Repeat the full axe audit (both themes, narrow viewport), check contrast manually, and test screen readers and voice control.
- [ ] Run every simulation in Safari, Chrome and Firefox on desktop.
- [x] Confirm the published baseline's successful GitHub CI and Pages deployment, as linked above. New local changes still require separately authorized integration and a new remote run.

Direct opening from `file://` remains untested; local verification uses an HTTP server.
