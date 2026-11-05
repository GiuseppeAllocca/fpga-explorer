# FPGA Explorer

An interactive, zoomable explorer of a Xilinx/AMD **Artix-7** FPGA: start from the development board and
dive down — chip, clock region, CLB, slice — to a single **LUT**, in **2D (SVG)** or **3D (Three.js / WebGL 2)**.
Every level has a short explanation, the key numbers and the source each claim comes from.

**Live demo:** https://giuseppeallocca.github.io/fpga-explorer/ · **3D view:** https://giuseppeallocca.github.io/fpga-explorer/3d.html

> Status: **work in progress (v0.1)**. The UI and the educational content are in Italian.
> Reference device: XC7A100T on a Digilent Nexys A7-100T (a reference, not necessarily the board you use).

## What it does

- 6 main levels (board → chip → clock region → CLB → slice → LUT) plus 7 side views (BRAM, DSP, I/O, clocking,
  interconnect, configuration, design flow): 57 nodes in total.
- Same navigation model and side panel in 2D and 3D; state (selection, SLICEL/SLICEM, LUT mode, theme) is kept when switching view.
- 3D scene built from real geometry (Three.js), selectable with raycasting, orbit/zoom/pan controls.
- Keyboard navigation, light/dark theme, `prefers-reduced-motion`, responsive layout (side panel or bottom sheet).
- Every statement is linked to a source (AMD user guides, Digilent manual) or explicitly flagged as
  *not from the cited sources* / *to be verified*.

## Stack

Vanilla JavaScript (ES modules) · SVG · [Three.js](https://threejs.org) 0.187 · [Vite](https://vite.dev) · [Vitest](https://vitest.dev) ·
GitHub Actions (CI + Pages). No runtime network requests; the production build ships a strict Content-Security-Policy.

## Run locally

```sh
npm ci
npm run dev      # development server
npm test         # data-integrity and privacy tests
npm run build    # production build in dist/
```

## Project layout

```
index.html, 3d.html      two entry pages (2D and 3D) sharing the same app
src/main.js              model, side panel and 2D renderer
src/three/renderer3d.js  3D renderer (loaded only on the 3D page)
src/data/fpga.json       the knowledge graph: nodes, sources, numbers
src/styles/app.css       styles and themes
tests/                   data-integrity tests
```

## Roadmap

- [ ] Verify every data point against the official AMD/Digilent documents (nodes marked "Da verificare")
- [ ] Split `main.js` into modules (model / panel / 2D renderer) and migrate to TypeScript
- [ ] Logic simulations, starting from the LUT (truth table → SRAM cells → read multiplexer)
- [ ] End-to-end tests (Playwright) and an accessibility audit
- [ ] Touch and cross-browser testing (Safari, Chrome, Firefox)
- [ ] English translation

## How it was made

Built with AI assistance (LLM coding agents) under the author's direction: the author defined the scope,
the structure and the acceptance criteria, and reviews the output. The educational content is compiled from public
documentation and is being verified source by source (see the roadmap). Corrections are welcome via issues.

## License

Code: [MIT](LICENSE). Educational content in `src/data/`: [CC BY 4.0](LICENSE-CONTENT.md).
Third-party notices and trademarks: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
AMD, Xilinx, Artix, Vivado, Digilent and Nexys are trademarks of their respective owners; this project is independent and unaffiliated.
