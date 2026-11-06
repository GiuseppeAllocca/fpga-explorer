import {chipFactories, type ChipId, type ChipStates, type PlaybackState} from './states';
import type {ChipUI, ChipSnapshots} from './types';

import {bramEdge, tristateAnd, resolvePin, routeBetween, divider, shiftBoundary, bitstreamBits} from './chip-logic.ts';

const ids: ChipId[] = ['sim_bram', 'sim_tristate', 'sim_switch', 'sim_clock', 'sim_jtag', 'sim_flow'];
const NS = 'http://www.w3.org/2000/svg';
const values = ['0', '1', 'Z'];

export function creaPannelloChip(ui: ChipUI) {
  const {dati, element, button, toggle, select, signal, commit, stop, animate} = ui;
  const emit = () => ui.emit?.();
  const halt = (s: PlaybackState) => {stop();s.playing = false;s.loading = false;};
  const row = (parent: Element) => element('div', null, parent, 'sim-inputs');
  const signals = (parent: Element) => element('div', null, parent, 'sim-signals');
  const factories = chipFactories(dati);
  // The key selects the factory and its corresponding state type.
  const initial = <K extends ChipId>(id: K): ChipStates[K] => factories[id]() as ChipStates[K];

  function snapshot<K extends ChipId>(id: K, state: ChipStates[K]): ChipSnapshots[K];
  function snapshot(id: ChipId, state: ChipStates[ChipId]): ChipSnapshots[ChipId] {
    const s = state;
    if (id === 'sim_tristate') {const s = state as ChipStates['sim_tristate'];return {id, ...s, y: tristateAnd(s.a, s.b, s.en), wire: resolvePin(s.fpga, s.external)} as ChipSnapshots[ChipId];}
    if (id === 'sim_bram') {const s = state as ChipStates['sim_bram'];return {id, ...s, cells: [...s.cells], ports: s.ports.map(p => ({...p})), outputs: [...s.outputs]} as ChipSnapshots[ChipId];}
    if (id === 'sim_switch') {const s = state as ChipStates['sim_switch'];return {id, routes: s.routes.map(r => [...r]), source: s.source} as ChipSnapshots[ChipId];}
    if (id === 'sim_jtag') {const s = state as ChipStates['sim_jtag'];return {id, ...s, cells: [...s.cells], read: [...s.read]} as ChipSnapshots[ChipId];}
    return {id, ...s} as ChipSnapshots[ChipId];
  }

  function node<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, parent?: Element) {
    const e = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) e.setAttribute(key, String(value));
    parent?.append(e);return e;
  }
  function diagram(parent: Element, height: number, name: string, width = 600) {
    const scroll = element('div', null, parent, 'chip-diagram-scroll');
    scroll.dataset.scroll = 'chip-' + name;
    scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',name);
    return node('svg', {viewBox: `0 0 ${width} ${height}`, class: 'chip-diagram', role: 'img', 'aria-label': name}, scroll);
  }
  function text(g: Element, value: string | number, x: number, y: number, className = '') {
    const t = node('text', {x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: className}, g);t.textContent = String(value);return t;
  }
  function box(g: Element, x: number, y: number, width: number, height: number, label: string | number | undefined, className = '') {
    node('rect', {x, y, width, height, rx: 6, class: 'chip-box ' + className}, g);
    if (label !== undefined) text(g, label, x + width / 2, y + height / 2);return g;
  }
  function wire(g: Element, x1: number, y1: number, x2: number, y2: number, className = '') {
    return node('path', {d: `M${x1} ${y1} L${x2} ${y2}`, class: 'chip-wire ' + className}, g);
  }
  function arrow(g: Element, x1: number, y1: number, x2: number, y2: number, className = '') {
    wire(g, x1, y1, x2, y2, className);
    const a = Math.atan2(y2 - y1, x2 - x1);
    node('path', {d: `M${x2 - 10 * Math.cos(a - .45)} ${y2 - 10 * Math.sin(a - .45)} L${x2} ${y2} L${x2 - 10 * Math.cos(a + .45)} ${y2 - 10 * Math.sin(a + .45)}`, class: 'chip-wire ' + className}, g);
  }
  function setSignal(output: HTMLOutputElement, name: string, value: string | number) {
    output.querySelector('strong')!.textContent = String(value);output.setAttribute('aria-label', name + ' · ' + value);
  }
  function numeric(name: string, value: number, min: number, max: number, key: string, action: (value: number) => void, parent: Element) {
    const label = element('label', null, parent, 'sim-field');element('span', name, label);
    const input = element('input', null, label);input.type = 'number';input.min = String(min);input.max = String(max);input.step = '1';input.value = String(value);input.dataset.control = key;
    input.required = true;const hint = element('small', min + '–' + max, label);hint.id = key + '-range';input.setAttribute('aria-describedby', hint.id);
    input.addEventListener('input', () => {
      const valid = input.value !== '' && input.checkValidity();input.setAttribute('aria-invalid', String(!valid));
      if (valid) {action(Number(input.value));emit();}
    });return input;
  }
  function range(name: string, value: number, min: number, max: number, step: number, key: string, action: (value: number) => void, parent: Element) {
    const label = element('label', null, parent, 'sim-field');element('span', name, label);
    const input = element('input', null, label);input.type = 'range';input.min = String(min);input.max = String(max);input.step = String(step);input.value = String(value);input.dataset.control = key;
    input.addEventListener('input', () => {action(Number(input.value));emit();});return input;
  }
  function validNumbers(parent: Element) {
    return [...parent.querySelectorAll<HTMLInputElement>('input[type="number"]')].every(input => input.value !== '' && input.reportValidity());
  }

  function bram(s: ChipStates['sim_bram'], parent: HTMLElement) {
    element('p', 'memoria ridotta a 16 parole per la visualizzazione', parent, 'sim-note');
    const highlight = () => parent.querySelectorAll<HTMLTableCellElement>('td[data-address]').forEach(e => e.classList.toggle('chip-memory-current', s.ports.some(p => p.address === Number(e.dataset.address))));
    const ports = element('div', null, parent, 'chip-ports');
    s.ports.forEach((p, i) => {
      const port = element('section', null, ports, 'sim-mini');element('h3', i ? 'Porta B' : 'Porta A', port);
      numeric('indirizzo', p.address, 0, 15, 'bram-address-' + i, v => {halt(s);p.address = v;highlight();}, port);
      numeric('D', p.data, 0, 255, 'bram-data-' + i, v => {halt(s);p.data = v;}, port);
      toggle('WE', p.we, 'bram-we-' + i, () => {halt(s);p.we ^= 1;}, port);
      select('Modo di scrittura', ['WRITE_FIRST', 'READ_FIRST', 'NO_CHANGE'].map(mode => [mode, mode]), p.mode, 'bram-mode-' + i, mode => {halt(s);p.mode = mode;}, port);
      signal('Q', s.outputs[i], port);
    });
    button('Fronte di clock', 'bram-clock', () => {
      if (!validNumbers(parent)) return;
      halt(s);const result = bramEdge(s.cells, s.ports.map((p, i) => ({...p, output: s.outputs[i]})));
      s.cells = result.cells;s.outputs = result.outputs;s.collision = result.collision;s.ports.forEach((p, i) => {p.output = s.outputs[i];});commit('bram-clock');
    }, parent);
    if (s.collision !== null) {const warning = element('p', 'collisione: valore non determinato', parent, 'chip-conflict');warning.setAttribute('role', 'status');}
    const scroll = element('div', null, parent, 'sim-scroll');scroll.dataset.scroll = 'bram-cells';
    scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','BRAM');
    const table = element('table', null, scroll, 'chip-memory');table.setAttribute('aria-label', 'BRAM');
    const body = element('tbody', null, table);
    s.cells.forEach((value, address) => {
      const tr = element('tr', null, body);const th = element('th', address, tr);th.scope = 'row';
      const td = element('td', null, tr);td.dataset.address = String(address);td.setAttribute('aria-label', address + ' · ' + value);
      if (s.ports.some(p => p.address === address)) td.classList.add('chip-memory-current');
      if (value === '?' || value === null) td.classList.add('chip-memory-unknown');
      const bits = value === '?' || value === null ? Array(8).fill('?') : Number(value).toString(2).padStart(8, '0').split('');
      bits.forEach(bit => {const cell = element('span', bit, td, 'sim-bit-cell');cell.dataset.bit = String(bit);});
    });
  }

  function tristate(s: ChipStates['sim_tristate'], parent: HTMLElement) {
    const inputs = row(parent);
    ([['A', 'a'], ['B', 'b'], ['EN', 'en']] as const).forEach(([name, key]) => toggle(name, s[key], 'tri-' + key, () => {halt(s);s[key] ^= 1;}, inputs));
    const y = tristateAnd(s.a, s.b, s.en);signal('Y', y, parent);
    const logic = diagram(parent, 220, 'AND · EN · Y');
    box(logic, 110, 65, 140, 100, 'AND');text(logic, 'A · ' + s.a, 48, 85);text(logic, 'B · ' + s.b, 48, 145);wire(logic, 80, 85, 110, 85);wire(logic, 80, 145, 110, 145);
    node('path', {d: 'M330 65 L330 165 L425 115 Z', class: 'chip-box'}, logic);wire(logic, 250, 115, 330, 115);wire(logic, 375, 35, 375, 90);text(logic, 'EN · ' + s.en, 375, 20);arrow(logic, 425, 115, 540, 115, y === 'Z' ? 'impedance' : 'active');text(logic, 'Y · ' + y, 510, 160);
    element('h3', 'Pin bidirezionale', parent);
    select('FPGA', values.map(v => [v, v]), s.fpga, 'pin-fpga', value => {halt(s);s.fpga = value;}, parent);
    select('I/O', values.map(v => [v, v]), s.external, 'pin-external', value => {halt(s);s.external = value;}, parent);
    const pin = resolvePin(s.fpga, s.external);signal('Pin', pin, parent);
    if (pin === 'X') {const p = element('p', 'conflitto', parent, 'chip-conflict');p.setAttribute('role', 'status');}
    const wiring = diagram(parent, 150, 'Pin bidirezionale');
    box(wiring, 20, 45, 135, 65, 'FPGA · ' + s.fpga);box(wiring, 445, 45, 135, 65, 'I/O · ' + s.external);wire(wiring, 155, 78, 445, 78, pin === 'Z' ? 'impedance' : pin === 'X' ? 'conflict' : 'active');text(wiring, 'Pin · ' + pin, 300, 120);
    const table = element('table', null, parent, 'chip-resolution');table.setAttribute('aria-label', 'Pin bidirezionale');
    const head = element('thead', null, table), header = element('tr', null, head);element('th', 'FPGA / I/O', header).scope = 'col';values.forEach(v => {element('th', v, header).scope = 'col';});
    const body = element('tbody', null, table);
    values.forEach(a => {const tr = element('tr', null, body);element('th', a, tr).scope = 'row';values.forEach(b => {const td = element('td', resolvePin(a, b), tr);if (s.fpga === a && s.external === b) td.setAttribute('aria-current', 'true');});});
  }

  function scegliSwitch(s: ChipStates['sim_switch'], index: number, key: string | null = 'route-' + index) {
    halt(s);
    if (s.source === null) s.source = index;
    else {
      if (s.routes.length === 3) s.routes.shift();
      s.routes.push(routeBetween(s.source, index));s.source = null;
    }
    commit(key);
  }
  function routing(s: ChipStates['sim_switch'], parent: HTMLElement) {
    const paths = signals(parent);signal('switch matrix attraversate', new Set(s.routes.flat()).size, paths);
    button('Cancella percorsi', 'routes-clear', () => {halt(s);s.routes = [];s.source = null;commit('routes-clear');}, parent);
    const scroll = element('div', null, parent, 'sim-scroll');scroll.dataset.scroll = 'chip-routing';
    const layout = element('div', null, scroll, 'chip-route-grid');const drawing = node('svg', {viewBox: '0 0 384 384', 'aria-hidden': 'true', class: 'chip-route-lines'}, layout);
    for (let r = 0; r < 4; r++) {wire(drawing, 72, 72 + r * 96, 360, 72 + r * 96);wire(drawing, 72 + r * 96, 72, 72 + r * 96, 360);}
    s.routes.forEach((route, i) => {
      const points = route.map(index => `${72 + index % 4 * 96},${72 + Math.floor(index / 4) * 96}`).join(' ');
      node('polyline', {points, class: 'chip-route-path route-' + i}, drawing);
    });
    for (let index = 0; index < 16; index++) {
      const used = s.routes.map((route, i) => route.includes(index) ? i : -1).filter(i => i >= 0);
      const b = button('CLB ' + index, 'route-' + index, () => scegliSwitch(s, index), layout, s.source === index);
      b.className = 'chip-route-clb';if (s.source === index) b.classList.add('source');
      const matrix = element('span', used.length ? null : '◇', b, 'chip-route-matrix');matrix.setAttribute('aria-hidden', 'true');
      if (used.length) {
        const last = used[used.length - 1], route = s.routes[last], position = route.indexOf(index), previous = position ? route[position - 1] : index;
        matrix.classList.add('route-' + last);matrix.dataset.entryClb = String(previous);
        const mux = node('svg', {viewBox: '0 0 32 32', class: 'chip-route-mux', 'aria-hidden': 'true'}, matrix);
        node('path', {d: 'M10 7 L24 11 V21 L10 25 Z', class: 'chip-route-mux-shape'}, mux);
        let incoming = previous === index ? 'M2 2 L10 10 M5 10 H10 V5'
          : Math.floor(previous / 4) === Math.floor(index / 4)
            ? previous < index ? 'M0 16 H10 M6 12 L10 16 L6 20' : 'M32 16 H24 M28 12 L24 16 L28 20'
            : previous < index ? 'M17 0 V9 M13 5 L17 9 L21 5' : 'M17 32 V23 M13 27 L17 23 L21 27';
        node('path', {d: incoming, class: 'chip-route-mux-input'}, mux);
        b.setAttribute('aria-label', 'CLB ' + index + ' · MUX ← CLB ' + previous + ' · ' + used.map(i => i + 1).join(' / '));
      }
    }
    element('p', 'schema: le linee reali sono segmentate e di lunghezze diverse', parent, 'sim-note');
  }

  function wave(g: Element, y: number, duty = 50, cycles = 4, delay = 0, className = '') {
    const left = 75, width = 490, period = width / cycles;let d = `M${left} ${y + 28}`;
    for (let i = 0; i < cycles; i++) {
      const start = left + i * period + delay, end = Math.min(left + width, start + period * duty / 100), tail = Math.min(left + width, left + (i + 1) * period + delay);
      if (start >= left + width) break;d += ` H${start} V${y} H${end} V${y + 28} H${tail}`;
    }
    node('path', {d, class: 'chip-wire chip-wave ' + className}, g);
  }
  function clockVisual(s: ChipStates['sim_clock'], host: HTMLElement) {
    host.replaceChildren();
    const g = diagram(host, s.mode === 'skew' ? 370 : 270, 'CLK');
    if (s.mode === 'skew') {
      box(g, 40, 35, 100, 65, 'CLK');box(g, 220, 35, 95, 65, 'FF');box(g, 465, 35, 95, 65, 'FF');arrow(g, 140, 68, 220, 68);arrow(g, 315, 68, 465, 68, s.dedicated ? 'active' : '');
      text(g, 'CLK', 32, 160);wave(g, 145, 50, 3);text(g, 'FF', 32, 230);wave(g, 215, 50, 3);text(g, 'FF', 32, 300);wave(g, 285, 50, 3, s.dedicated ? 0 : 30);
      wire(g, 75, 130, 75, 335, 'chip-reference');wire(g, s.dedicated ? 75 : 105, 270, s.dedicated ? 75 : 105, 335, 'chip-reference');
      if (!s.dedicated) {wire(g, 75, 350, 105, 350, 'active');text(g, 'Skew', 180, 350);}
      if (s.phase > 0) wire(g, 75 + Math.min(s.phase, 16) / 16 * 490, 125, 75 + Math.min(s.phase, 16) / 16 * 490, 335, 'active');
    } else if (s.mode === 'divider') {
      text(g, '100 MHz', 160, 30);text(g, 'CLK', 30, 90);wave(g, 75, 50, Math.min(16, 2 * s.n));
      if (s.n > 8) text(g, "onda d'ingresso compressa", 320, 140);
      text(g, 'Q', 30, 195);wave(g, 180, 50, 1, 0, 'active');text(g, divider(s.n).periodText, 320, 245);
    } else {
      text(g, 'Duty cycle · ' + s.duty + '%', 300, 35);text(g, 'CLK', 30, 110);wave(g, 95, s.duty, 3, 0, 'active');
    }
  }
  function clock(s: ChipStates['sim_clock'], parent: HTMLElement) {
    const tabs = row(parent);
    [['skew', 'Skew'], ['divider', 'Divisore di frequenza'], ['duty', 'Duty cycle']].forEach(([mode, name]) => button(name, 'clock-mode-' + mode, () => {halt(s);s.mode = mode;s.phase = 0;commit('clock-mode-' + mode);}, tabs, mode === s.mode));
    if (s.mode === 'skew') {
      button('rete di clock dedicata', 'clock-dedicated', () => {halt(s);s.dedicated = !s.dedicated;s.phase = 0;commit('clock-dedicated');}, parent, s.dedicated);
      button('Riproduci', 'clock-play', () => {
        s.phase = 0;s.playing = true;animate({key: 'clock-play', advance: () => {s.phase++;if (s.phase >= 16) s.playing = false;return s.phase >= 16;}, finish: () => {s.phase = 16;s.playing = false;}});
      }, parent);
    }
    const visual = element('div', null, parent);
    if (s.mode === 'divider') {
      let slider: HTMLInputElement | undefined;
      const outputs = signals(parent);signal('CLK', '100 MHz', outputs);const result = divider(s.n);const period = signal('periodo', result.periodText, outputs), frequency = signal('frequenza', result.frequencyText, outputs);
      const refresh = () => {const r = divider(s.n);setSignal(period, 'periodo', r.periodText);setSignal(frequency, 'frequenza', r.frequencyText);clockVisual(s, visual);slider?.setAttribute('aria-valuetext', 'N · ' + s.n);};
      const n = numeric('N', s.n, 1, 1000000, 'clock-n', value => {halt(s);s.n = value;if (slider) slider.value = String(Math.log10(value));refresh();}, parent);
      slider = range('N', Math.log10(s.n), 0, 6, .001, 'clock-n-range', value => {halt(s);s.n = Math.max(1, Math.min(1000000, Math.round(10 ** value)));n.value = String(s.n);n.setAttribute('aria-invalid', 'false');refresh();}, parent);slider.setAttribute('aria-valuetext', 'N · ' + s.n);
    } else if (s.mode === 'duty') {
      const out = signal('Duty cycle', s.duty + '%', parent);
      const slider = range('Duty cycle', s.duty, 10, 90, 1, 'clock-duty', value => {halt(s);s.duty = value;setSignal(out, 'Duty cycle', value + '%');slider.setAttribute('aria-valuetext', value + '%');clockVisual(s, visual);}, parent);slider.setAttribute('aria-valuetext', s.duty + '%');
    }
    clockVisual(s, visual);
  }

  function boundaryVisual(s: ChipStates['sim_jtag'], parent: HTMLElement) {
    const g = diagram(parent, 365, 'JTAG · TDI · TDO');box(g, 160, 50, 280, 250, 'ARTIX-7');
    const coords = [[185, 70], [285, 70], [410, 70], [420, 160], [410, 280], [300, 280], [180, 280], [180, 175]];
    coords.forEach(([x, y], i) => {
      if (s.test && i) wire(g, coords[i - 1][0], coords[i - 1][1], x, y, 'active');
      if (!s.test) {const tx = x < 250 ? 255 : x > 350 ? 345 : x, ty = y < 120 ? 135 : y > 220 ? 215 : y;arrow(g, x, y, tx, ty);}
      box(g, x - 20, y - 20, 40, 40, s.cells[i], 'chip-cell');
      node('path', {d: `M${x - 12} ${y - 9} L${x + 11} ${y - 5} V${y + 5} L${x - 12} ${y + 9} Z`, class: 'chip-mux-mini'}, g);
    });
    arrow(g, 35, 70, 165, 70, s.test ? 'active' : '');text(g, 'TDI · ' + s.tdi, 80, 35);arrow(g, 160, 175, 40, 175, s.test ? 'active' : '');text(g, 'TDO · ' + s.tdo, 75, 215);text(g, 'TCK', 300, 340);wire(g, 300, 320, 300, 300);
  }
  function loadBitstream(s: ChipStates['sim_jtag'], key: string) {
    halt(s);s.progress = 0;s.done = false;s.loading = true;
    animate({key, interval: 100, advance: () => {s.progress = Math.min(100, s.progress + 5);s.done = s.progress === 100;if (s.done) s.loading = false;return s.done;}, finish: () => {s.progress = 100;s.done = true;s.loading = false;}});
  }
  function jtag(s: ChipStates['sim_jtag'], parent: HTMLElement) {
    const modes = row(parent);
    ([['Funzionamento normale', false], ['Collaudo', true]] as const).forEach(([name, test]) => button(name, 'jtag-mode-' + test, () => {halt(s);s.test = test;commit('jtag-mode-' + test);}, modes, s.test === test));
    const controls = row(parent);const tdi = toggle('TDI', s.tdi, 'jtag-tdi', () => {halt(s);s.tdi ^= 1;}, controls);tdi.disabled = !s.test;
    const edge = button('Fronte di TCK', 'jtag-tck', () => {halt(s);const r = shiftBoundary(s.cells, s.tdi);s.cells = r.cells;s.tdo = r.tdo;s.read.push(r.tdo);commit('jtag-tck');}, controls);edge.disabled = !s.test;
    boundaryVisual(s, parent);signal('letti da TDO', s.read.length ? s.read.join(' ') : '—', parent);
    const bitstream = element('section', null, parent, 'chip-bitstream');element('h3', 'Bitstream', bitstream);
    const number = dati.nodi.configurazione.numeri.find(r => r.voce.includes('XC7A100T'));if (number) element('p', number.valore, bitstream, 'sim-note');
    element('p', 'animazione, non tempo reale', bitstream, 'sim-note');
    const label = element('label', null, bitstream, 'sim-field');element('span', 'Bitstream', label);const progress = element('progress', null, label);progress.max = 100;progress.value = s.progress;progress.setAttribute('aria-label', 'Bitstream');progress.setAttribute('aria-valuetext', s.progress + '%');
    const out = signals(bitstream);signal('Bitstream', s.progress + '%', out);const done = signal('DONE', Number(s.done), out);done.classList.toggle('chip-done', s.done);
    const load = row(bitstream);button('Carica bitstream', 'bitstream-load', () => loadBitstream(s, 'bitstream-load'), load);
    button('Spegni la board', 'bitstream-off', () => {halt(s);s.progress = 0;s.done = false;commit('bitstream-off');}, load);
    button('Riaccendi dalla flash', 'bitstream-flash', () => loadBitstream(s, 'bitstream-flash'), load);
  }

  function flowVisual(s: ChipStates['sim_flow'], parent: HTMLElement) {
    const g = diagram(parent, 290, dati.nodi.flusso.passi[s.step].nome);
    if (s.step === 0) {box(g, 220, 75, 180, 110, 'sommatore');arrow(g, 60, 100, 220, 100);arrow(g, 60, 160, 220, 160);arrow(g, 400, 130, 550, 130);text(g, 'A', 40, 100);text(g, 'B', 40, 160);text(g, 'Y', 565, 130);text(g, 'codice VHDL', 300, 235);}
    else if (s.step === 1) {text(g, 'CLK', 30, 70);wave(g, 55, 50, 4);text(g, 'D', 30, 145);wave(g, 130, 25, 3);text(g, 'Q', 30, 220);wave(g, 205, 50, 2);}
    else if (s.step === 2) {box(g, 85, 30, 430, 230, undefined, 'chip-board');box(g, 265, 85, 120, 120, 'ARTIX-7');box(g, 115, 105, 55, 60, 'I/O');arrow(g, 170, 135, 265, 135, 'active');text(g, 'Pin', 220, 105);}
    else if (s.step === 3) {['LUT', 'FF', 'MUXCY'].forEach((name, i) => {box(g, 90, 25 + i * 80, 170, 60, name);text(g, name === 'MUXCY' ? 'CIN → COUT' : name === 'FF' ? 'D → Q' : 'A1–A6 → O6', 425, 55 + i * 80);});}
    else if (s.step === 4) {for (let i = 0; i < 4; i++) {const x = 90 + i % 2 * 300, y = 35 + Math.floor(i / 2) * 130;box(g, x, y, 130, 75, i % 2 ? 'FF' : 'LUT');box(g, x + 145, y + 60, 45, 35, 'MUX');}if (s.route) {node('path', {d: 'M220 73 H257 V112 H557 V203 H520', class: 'chip-wire active'}, g);arrow(g, 520, 203, 390, 203, 'active');}text(g, s.route ? 'Route' : 'Place', 300, 275);}
    else if (s.step === 5) {box(g, 70, 85, 100, 100, 'FF');box(g, 430, 85, 100, 100, 'FF');arrow(g, 170, 135, 430, 135, 'active');text(g, 'vincolo rispettato?', 300, 235);}
    else {box(g, 80, 85, 360, 65, undefined, 'chip-complete');text(g, 'Bitstream', 260, 117);node('circle', {cx: 510, cy: 117, r: 22, class: 'chip-led-done'}, g);text(g, 'DONE', 510, 175);text(g, 'ARTIX-7', 300, 235);}
  }
  function flow(s: ChipStates['sim_flow'], parent: HTMLElement) {
    const steps = dati.nodi.flusso.passi;
    const scroll = element('div', null, parent, 'sim-scroll');scroll.dataset.scroll = 'chip-flow';const stepper = element('ol', null, scroll, 'chip-stepper');
    steps.forEach((step, i) => {const li = element('li', null, stepper);const b = button(step.nome, 'flow-' + i, () => scegliPasso(s, i), li, s.step === i);if (s.step === i) b.setAttribute('aria-current', 'step');});
    element('h3', steps[s.step].nome, parent);element('p', steps[s.step].testo, parent, 'sim-note');
    const controls = row(parent);const previous = button('Passo precedente', 'flow-prev', () => scegliPasso(s, Math.max(0, s.step - 1), 'flow-prev'), controls);previous.disabled = s.step === 0;
    const next = button('Passo successivo', 'flow-next', () => scegliPasso(s, Math.min(steps.length - 1, s.step + 1), 'flow-next'), controls);next.disabled = s.step === steps.length - 1;
    if (s.step === 4) {const placement = row(parent);['Place', 'Route'].forEach((name, i) => button(name, 'flow-route-' + i, () => {halt(s);s.route = Boolean(i);commit('flow-route-' + i);}, placement, s.route === Boolean(i)));}
    flowVisual(s, parent);
  }

  function scegliPasso(s: ChipStates['sim_flow'], index: number, key: string | null = 'flow-' + index) {
    if (!Number.isInteger(index) || index < 0 || index >= dati.nodi.flusso.passi.length) return;
    halt(s);s.step = index;s.route = false;commit(key);
  }

  function paint<K extends ChipId>(id: K, s: ChipStates[K], parent: HTMLElement) {
    parent.classList.add('chip-simulation');
    const painters: {[K in ChipId]: (state: ChipStates[K], parent: HTMLElement) => void} = {sim_bram: bram, sim_tristate: tristate, sim_switch: routing, sim_clock: clock, sim_jtag: jtag, sim_flow: flow};
    painters[id](s, parent);
  }
  return {ids, initial, snapshot, paint, scegliSwitch, scegliPasso};
}
