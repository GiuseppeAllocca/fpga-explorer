# FPGA Explorer

An interactive, zoomable explorer of a Xilinx/AMD **Artix-7** FPGA: start from the development board and
dive down — chip, clock region, CLB, slice — to a single **LUT**, in **2D (SVG)** or **3D (Three.js / WebGL 2)**.
Every level has a short explanation, the key numbers and the source each claim comes from.

**Live demo:** https://giuseppeallocca.github.io/fpga-explorer/ · **3D view:** https://giuseppeallocca.github.io/fpga-explorer/3d.html

> Status: **work in progress (v0.4)**. The UI and the educational content are in Italian.
> Reference device: XC7A100T on a Digilent Nexys A7-100T (a reference, not necessarily the board you use).

## What it does

- 6 main levels (board → chip → clock region → CLB → slice → LUT) plus 7 side views (BRAM, DSP, I/O, clocking,
  interconnect, configuration, design flow): 57 nodes in total.
- Same navigation model and side panel in 2D and 3D; state (selection, SLICEL/SLICEM, LUT mode, theme) is kept when switching view.
- 3D scene built from real geometry (Three.js), selectable with raycasting, orbit/zoom/pan controls.
- Keyboard navigation, light/dark theme, `prefers-reduced-motion`, responsive layout (side panel or bottom sheet).
- Every statement is linked to a source (AMD user guides, Digilent manual) or explicitly flagged as
  *not from the cited sources* / *to be verified*.

## Simulations ("Prova" tab)

Twelve interactive experiments, available in both views:

- **Logic:** 6-input LUT with dual output, wide multiplexers, flip-flop vs latch, distributed RAM, shift register, 8/32-bit carry chain.
- **Chip:** dual-port block RAM (write modes, collisions), tri-state buffer and pin resolution, CLB routing grid, clock skew and divider, boundary scan with bitstream loading, the seven steps of the design flow.

Simulation state lives in the page until reset or reload; switching between 2D and 3D keeps navigation, not memory contents.
The tests cover all 64 input combinations of the LUT, the 256 addresses of the multiplexer and all 65,536 operand pairs of the 8-bit adder.

## Quality

72 automated tests, strict CSP, axe-core audit and manual browser checks. What was verified and what is still open
(touch devices, assistive technologies, performance on a tablet) is listed in [docs/testing.md](docs/testing.md).

## Stack

Vanilla TypeScript (strict, ES modules) · SVG · [Three.js](https://threejs.org) 0.187 · [Vite](https://vite.dev) · [Vitest](https://vitest.dev) ·
GitHub Actions (CI + Pages). No runtime network requests; the production build ships a strict Content-Security-Policy.

## Run locally

```sh
npm ci
npm run dev      # development server
npm run typecheck # strict TypeScript checks
npm test         # data integrity, privacy guard, simulation logic
npm run build    # production build in dist/
```

## Project layout

```
index.html, 3d.html      two entry pages (2D and 3D) sharing the same app
src/main.ts              bootstrap and module wiring
src/model/               state, navigation, URL and renderer contracts
src/panel/               side panel, board controls and announcements
src/render2d/            SVG rendering and diagram interaction
src/three/renderer3d.ts  3D renderer (loaded only on the 3D page)
src/ui/                  DOM helpers and application controls
src/simulations/        simulation models and controls shared by 2D and 3D
src/data/                unchanged knowledge graph and checked TypeScript data types
src/styles/              styles, themes, simulation controls
tests/                   data integrity, privacy guard, simulations
docs/testing.md          what was verified and what is still open
```

The model receives renderer and panel callbacks; shared contracts are type-only imports. Simulation state and
snapshots are typed by simulation id. Three.js remains behind the 3D entry page's dynamic import.

## How it was made

Built with AI assistance (LLM coding agents) under the author's direction: the author defined the scope, the structure
and the acceptance criteria, and reviews the output.

The educational content is based on the author's own study notes (not published in this repository): an AI assistant
extracted definitions and explanations from them and compiled them with public AMD and Digilent documentation. The author
is reviewing the notes and the content against them, and checking every claim against the cited sources; some items are
still marked "Da verificare". Corrections are welcome via issues.

## License

Code: [MIT](LICENSE). Educational content in `src/data/`: [CC BY 4.0](LICENSE-CONTENT.md).
Third-party notices and trademarks: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
AMD, Xilinx, Artix, Vivado, Digilent and Nexys are trademarks of their respective owners; this project is independent and unaffiliated.
