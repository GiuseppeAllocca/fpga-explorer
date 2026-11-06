import {address, binary, lutTable, readLut, wideTable, readWide, smallMux, timingTrace, writeRam, shiftRegister, carryTrace} from './logic.js';
import {creaPannelloChip} from './chip-panel.js';

const supported = new Set(['sim_lut', 'sim_widemux', 'sim_ff_latch', 'sim_distram', 'sim_srl', 'sim_carry']);
const initial = id => ({
  sim_lut: () => ({inputs: binary(0, 6), cells: lutTable('and'), function: 'and', split: false}),
  sim_widemux: () => ({inputs: binary(0, 8), table: wideTable('parity'), function: 'parity', seed: 0x5eed, small: false, abc: [0, 0, 0]}),
  sim_ff_latch: () => ({data: Array(16).fill(0), step: 0, latch: false}),
  sim_distram: () => ({cells: Array(64).fill(0), inputs: binary(0, 6), d: 0, we: 0, blocked: false}),
  sim_srl: () => ({cells: Array(32).fill(0), marks: Array(32).fill(false), d: 0, marked: false, address: 0, edges: 0}),
  sim_carry: () => ({a: 0, b: 0, width: 8, step: 0}),
}[id]());

export function creaSimulazioni({dati, cambiato, riduciMovimento}) {
  const states = new Map();
  let active = null, host = null, timer = null;
  const chip = creaPannelloChip({dati, element, button, toggle, select, signal, grid, commit, emit: () => emit(), stop, animate, riduciMovimento});
  const initialState = id => chip.ids.includes(id) ? chip.initial(id) : initial(id);
  const state = () => states.get(active);
  const emit = () => cambiato(snapshot());
  function element(tag, text, parent, className) {
    const e = document.createElement(tag);
    if (text !== null && text !== undefined) e.textContent = String(text);
    if (className) e.className = className;
    parent?.append(e);
    return e;
  }
  function button(text, key, action, parent, pressed) {
    const e = element('button', text, parent);e.type = 'button';e.dataset.control = key;
    if (pressed !== undefined) e.setAttribute('aria-pressed', String(Boolean(pressed)));
    e.addEventListener('click', action);
    return e;
  }
  function commit(key) {paint(key);emit();}
  function toggle(name, value, key, action, parent) {
    const b = button(`${name} · ${value}`, key, () => {action();commit(key);}, parent, value);
    b.dataset.bit = String(value);return b;
  }
  function inputs(prefix, values, key, parent, locked = false, after) {
    const row = element('div', null, parent, 'sim-inputs');
    for (let i = values.length - 1; i >= 0; i--) {
      const b = toggle(prefix + (i + 1), values[i], key + i, () => {values[i] ^= 1;after?.();}, row);
      b.disabled = locked && i === 5;
    }
  }
  function select(label, options, value, key, action, parent) {
    const field = element('label', null, parent, 'sim-field');element('span', label, field);
    const e = element('select', null, field);e.dataset.control = key;
    options.forEach(([v, text]) => {const o = element('option', text, e);o.value = v;});
    e.value = value;e.addEventListener('change', () => {action(e.value);commit(key);});return e;
  }
  function signal(name, value, parent) {
    const e = element('output', null, parent, 'sim-signal');element('span', name, e);element('strong', value, e);
    e.dataset.signal = name;
    e.setAttribute('aria-label', name + ' · ' + value);return e;
  }
  function grid(cells, columns, parent, {selected = [], edit, offset = 0, quarter = false, marks = []} = {}) {
    const scroll = element('div', null, parent, 'sim-scroll');scroll.dataset.scroll = 'grid-' + offset + '-' + columns;
    if (!edit) {scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',columns===32?'Shift register':`SRAM ${offset}–${offset+cells.length-1}`);}
    const g = element('div', null, scroll, 'sim-grid' + (edit ? ' editable' : ''));g.style.setProperty('--cols', columns);
    cells.forEach((v, i) => {
      const a = i + offset, label = `${v}${marks[i] ? ' ★' : ''}`;
      const e = edit ? button(label, 'cell-' + a, () => {edit(i);commit('cell-' + a);}, g, v) : element('span', label, g);
      if (!edit) e.setAttribute('role', 'img');
      e.classList.add('sim-bit-cell');e.dataset.cell = String(a);e.dataset.bit = String(v);
      e.setAttribute('aria-label', `SRAM ${a} · ${label}`);
      if (selected.includes(a)) {e.classList.add('read');e.setAttribute('aria-current', 'true');}
      if (marks[i]) e.classList.add('marked');
      if (quarter) e.classList.add('quarter-' + Math.floor(a / 64));
    });
    return g;
  }
  function snapshot() {
    const ffLatch = states.get('sim_ff_latch')?.latch || false;
    const configuration = states.has('sim_jtag') ? {configuration: chip.snapshot('sim_jtag', states.get('sim_jtag'))} : {};
    if (!active) return {id: null, ffLatch, ...configuration};
    const s = state(), common = {id: active, ffLatch, ...configuration};
    if (chip.ids.includes(active)) return {...common, ...chip.snapshot(active, s)};
    if (active === 'sim_lut') return {...common, ...readLut(s.cells, s.inputs, s.split), cells: s.cells, split: s.split, editable: s.function === 'custom'};
    if (active === 'sim_distram') return {...common, address: address(s.inputs), cells: s.cells, output: s.cells[address(s.inputs)], blocked: s.blocked};
    if (active === 'sim_srl') return {...common, address: s.address, cells: s.cells, marks: s.marks, output: s.cells[s.address]};
    if (active === 'sim_widemux') return {...common, ...readWide(s.table, s.inputs), small: s.small, inputs: s.inputs};
    if (active === 'sim_carry') return {...common, ...carryTrace(s.a, s.b, s.width), step: s.step, width: s.width};
    return {...common, step: s.step, trace: timingTrace(s.data)};
  }
  function stop(pause = false) {
    if (timer !== null) clearInterval(timer);timer = null;
    if (pause && active && chip.ids.includes(active)) {state().playing = false;state().loading = false;}
  }
  function animate({advance, finish, interval = 250, key}) {
    stop();
    if (riduciMovimento()) {finish();commit(key);return;}
    timer = setInterval(() => {if (advance()) stop();commit();}, interval);
    commit(key);
  }
  function play(kind) {
    if (timer !== null) {stop();commit('play');return;}
    const s = state(), total = kind === 'carry' ? s.width : 16;
    if (s.step >= total) s.step = 0;
    if (riduciMovimento()) {s.step = total;commit('play');return;}
    timer = setInterval(() => {
      s.step++;
      if (s.step >= total) stop();
      commit();
    }, 250);
    commit('play');
  }
  function lut(parent) {
    const s = state();
    select('Funzione', [['and', 'AND di 6 variabili'], ['xor', 'XOR di 6 variabili'], ['mux', 'Multiplexer 4:1'], ['custom', 'Personalizzata']], s.function, 'function', value => {
      s.function = value;if (value !== 'custom') s.cells = lutTable(value);
    }, parent);
    inputs('A', s.inputs, 'a', parent, s.split);
    button('Due LUT a 5 ingressi', 'split', () => {s.split = !s.split;if (s.split) s.inputs[5] = 1;commit('split');}, parent, s.split);
    const r = readLut(s.cells, s.inputs, s.split), row = element('div', null, parent, 'sim-signals');
    signal('indirizzo', `${r.address} · ${r.address.toString(2).padStart(6, '0')}`, row);
    signal('O6', r.o6, row);if (s.split) signal('O5', r.o5, row);
    if (s.split) element('p', dati.nodi.lut.spiegazione[2], parent, 'sim-note');
    grid(s.cells, 8, parent, {selected: s.split ? [r.low, r.address] : [r.address], edit: s.function === 'custom' ? i => {s.cells[i] ^= 1;} : null});
  }
  function wide(parent) {
    const s = state(), modes = element('div', null, parent, 'sim-inputs');
    [['7 e 8 variabili', false], ['Esempio piccolo', true]].forEach(([label, small]) => button(label, 'wide-' + small, () => {s.small = small;commit('wide-' + small);}, modes, s.small === small));
    if (s.small) {
      const row = element('div', null, parent, 'sim-inputs');
      ['a', 'b', 'c'].forEach((name, i) => toggle(name, s.abc[i], 'abc-' + i, () => {s.abc[i] ^= 1;}, row));
      const r = smallMux(...s.abc);
      const pair = element('div', null, parent, 'sim-pair');
      [ ['AND', [0, 0, 0, 1], r.and, !s.abc[2]], ['OR', [0, 1, 1, 1], r.or, !!s.abc[2]] ].forEach(([name, cells, value, used]) => {
        const p = element('section', null, pair, 'sim-mini' + (used ? ' used' : ''));element('h3', name, p);
        grid(cells, 2, p, {selected: [s.abc[0] + 2 * s.abc[1]]});signal('O', value, p);
      });
      signal('MUX · c', r.output, parent);element('p', 'variabili: 2 + 1 = 3', parent);return;
    }
    select('Funzione', [['parity', 'Parità di 8 variabili'], ['random', 'Funzione casuale']], s.function, 'wide-function', value => {s.function = value;s.table = wideTable(value, s.seed);}, parent);
    if (s.function === 'random') button('Nuova funzione casuale', 'random', () => {s.seed++;s.table = wideTable('random', s.seed);commit('random');}, parent);
    inputs('x', s.inputs, 'x', parent);
    const r = readWide(s.table, s.inputs), row = element('div', null, parent, 'sim-signals');
    signal('F7AMUX', r.f7a, row);signal('F7BMUX', r.f7b, row);signal('F8MUX', r.output, row);
    const mini = element('div', null, parent, 'sim-pair');
    ['A', 'B', 'C', 'D'].forEach((name, i) => {
      const p = element('section', null, mini, 'sim-mini quarter-' + i + (r.quarter === i ? ' used' : ''));element('h3', 'LUT ' + name, p);
      grid(s.table.slice(i * 64, i * 64 + 64), 8, p, {selected: [i * 64 + r.local], offset: i * 64});
    });
    element('h3', 'tabella completa', parent);grid(s.table, 16, parent, {selected: [r.address], quarter: true});
  }
  function timing(parent) {
    const s = state(), trace = timingTrace(s.data);
    const scroll = element('div', null, parent, 'sim-scroll');scroll.dataset.scroll = 'timing';
    const table = element('div', null, scroll, 'sim-timing');
    [['CLK', 'clk'], ['D', 'd'], ['Q · FF', 'ff'], ['Q · Latch', 'latch']].forEach(([name, key]) => {
      element('strong', name, table);
      trace.forEach((v, i) => {
        const e = key === 'd' ? button(v.d, 'd-' + i, () => {s.data[i] ^= 1;commit('d-' + i);}, table, v.d) : element('span', v[key], table);
        if (key !== 'd') e.setAttribute('role','img');
        e.classList.add('sim-wave');e.dataset.bit = String(v[key]);e.setAttribute('aria-label', `${name} · ${i + 1} · ${v[key]}`);
        if (i === Math.min(s.step, 15)) e.classList.add('cursor');
      });
    });
    const row = element('div', null, parent, 'sim-inputs');
    button('Passo', 'step', () => {stop();s.step = s.step >= 15 ? 0 : s.step + 1;commit('step');}, row);
    button(timer !== null ? 'Pausa' : 'Riproduci', 'play', () => play('timing'), row);
    select('Configurazione della slice', [['ff', '8 flip-flop'], ['latch', '4 latch']], s.latch ? 'latch' : 'ff', 'ff-mode', value => {s.latch = value === 'latch';}, parent);
  }
  function ram(parent) {
    const s = state();inputs('A', s.inputs, 'ram-a', parent, false, () => {s.blocked = false;});
    const row = element('div', null, parent, 'sim-inputs');
    toggle('D', s.d, 'ram-d', () => {s.d ^= 1;}, row);toggle('WE', s.we, 'ram-we', () => {s.we ^= 1;}, row);
    button('Fronte di clock', 'ram-clock', () => {s.cells = writeRam(s.cells, address(s.inputs), s.d, s.we);s.blocked = !s.we;commit('ram-clock');}, parent);
    const signals = element('div', null, parent, 'sim-signals');signal('indirizzo', address(s.inputs), signals);signal('Q', s.cells[address(s.inputs)], signals);
    grid(s.cells, 8, parent, {selected: [address(s.inputs)]});
    parent.classList.toggle('write-blocked', s.blocked);
  }
  function srl(parent) {
    const s = state(), row = element('div', null, parent, 'sim-inputs');
    toggle('D', s.d, 'srl-d', () => {s.d ^= 1;}, row);
    button('D ★', 'mark', () => {s.marked = !s.marked;commit('mark');}, row, s.marked);
    button('Fronte di clock', 'srl-clock', () => {
      Object.assign(s, shiftRegister(s.cells, s.marks, s.d, s.marked));s.marked = false;s.edges++;commit('srl-clock');
    }, parent);
    const field = element('label', null, parent, 'sim-field');element('span', 'indirizzo', field);
    const range = element('input', null, field);range.type = 'range';range.min = '0';range.max = '31';range.step = '1';range.value = String(s.address);range.dataset.control = 'srl-address';
    const signals = element('div', null, parent, 'sim-signals');
    const qValue = () => `${s.cells[s.address]}${s.marks[s.address] ? ' ★' : ''}`;
    const length = signal('lunghezza = indirizzo + 1', s.address + 1, signals), q = signal('Q', qValue(), signals);signal('fronti', s.edges, signals);
    const g = grid(s.cells, 32, parent, {selected: [s.address], marks: s.marks});
    range.addEventListener('input', () => {
      s.address = Number(range.value);length.querySelector('strong').textContent = String(s.address + 1);q.querySelector('strong').textContent = qValue();
      length.setAttribute('aria-label', 'lunghezza = indirizzo + 1 · ' + (s.address + 1));q.setAttribute('aria-label', 'Q · ' + qValue());
      [...g.children].forEach((e, i) => {e.classList.toggle('read', i === s.address);e.setAttribute('aria-current', String(i === s.address));});emit();
    });
  }
  function carry(parent) {
    const s = state();
    for (const name of ['a', 'b']) {
      const field = element('label', null, parent, 'sim-field');element('span', name.toUpperCase(), field);
      const input = element('input', null, field);input.type = 'number';input.min = '0';input.max = '255';input.step = '1';input.value = String(s[name]);input.dataset.control = name + '-number';
      input.required = true;const hint = element('small', '0–255', field);hint.id = 'carry-' + name + '-range';input.setAttribute('aria-describedby', hint.id);
      input.addEventListener('input', () => {
        stop();host.classList.remove('running');host.querySelector('[data-control="play"]').textContent='Esegui tutto';
        const valid=input.value!==''&&input.checkValidity();input.setAttribute('aria-invalid',String(!valid));
        if (!valid) return;
        s[name] = Number(input.value);s.step = 0;
        binary(s[name], 8).forEach((v, i) => {const b=host.querySelector(`[data-control="carry-${name}${i}"]`);b.textContent=`${name.toUpperCase()}${i+1} · ${v}`;b.dataset.bit=String(v);b.setAttribute('aria-pressed',String(Boolean(v)));});
        host.querySelectorAll('.sim-carry-stage').forEach(e=>{e.classList.remove('done','cursor');e.children[2].textContent='CIN — → COUT —';e.children[3].textContent='XOR —';});
        host.querySelectorAll('.sim-carry-link').forEach(e=>e.classList.remove('crossed'));
        for(const [key,value] of [['slice attraversate','0'],['A + B','—']]){const o=host.querySelector(`[data-signal="${key}"]`);if(o){o.querySelector('strong').textContent=value;o.setAttribute('aria-label',key+' · '+value);}}
        host.querySelector('[data-control="carry-step"]').disabled=false;host.querySelector('[data-control="play"]').textContent='Esegui tutto';emit();
      });
      const values = binary(s[name], 8);
      inputs(name.toUpperCase(), values, 'carry-' + name, parent, false, () => {s[name] = address(values);s.step = 0;stop();});
    }
    select('Larghezza', [['8', '8 bit'], ['32', '32 bit']], String(s.width), 'width', value => {s.width = Number(value);s.step = 0;stop();}, parent);
    const row = element('div', null, parent, 'sim-inputs');
    const valid = () => [...host.querySelectorAll('input[type="number"]')].every(e => e.value !== '' && e.reportValidity());
    const step = button('Avanza di un bit', 'carry-step', () => {if(!valid())return;stop();s.step = Math.min(s.width, s.step + 1);commit('carry-step');}, row);step.disabled = s.step >= s.width;
    button(timer !== null ? 'Pausa' : 'Esegui tutto', 'play', () => {if(valid())play('carry');}, row);
    const r = carryTrace(s.a, s.b, s.width), outputs = element('div', null, parent, 'sim-signals');
    signal('slice attraversate', Math.ceil(s.step / 4), outputs);signal('A + B', s.step === s.width ? r.result : '—', outputs);
    const chain = element('div', null, parent, 'sim-carry-chain');
    for (let slice = s.width / 4 - 1; slice >= 0; slice--) {
      const section = element('section', null, chain, 'sim-mini');element('h3', 'Slice ' + slice, section);
      for (let j = 3; j >= 0; j--) {
        const i = slice * 4 + j, v = r.stages[i], done = i < s.step;
        const line = element('div', null, section, 'sim-carry-stage' + (done ? ' done' : '') + (i === s.step - 1 ? ' cursor' : ''));
        element('span', i, line);element('span', 'MUXCY', line);element('span', `CIN ${done ? v.cin : '—'} → COUT ${done ? v.cout : '—'}`, line);element('span', `XOR ${done ? v.q : '—'}`, line);
      }
      if (slice > 0) element('div', 'COUT ↑ CIN', chain, 'sim-carry-link' + (s.step >= slice * 4 ? ' crossed' : ''));
    }
  }
  function paint(focusKey) {
    if (!host || !active) return;
    if(focusKey===undefined)focusKey=[...host.querySelectorAll('[data-control]')].find(e=>e===document.activeElement)?.dataset.control;
    const scrolls = [...host.querySelectorAll('[data-scroll]')].map(e => [e.dataset.scroll, e.scrollLeft]);
    host.replaceChildren();host.dataset.sim = active;host.className = 'simulation';host.classList.toggle('running', timer !== null);
    const reset = button('Ricomincia', 'reset', () => {stop();states.set(active, initialState(active));commit('reset');}, host);reset.className = 'sim-reset';
    if (chip.ids.includes(active)) chip.paint(active, state(), host);
    else ({sim_lut: lut, sim_widemux: wide, sim_ff_latch: timing, sim_distram: ram, sim_srl: srl, sim_carry: carry})[active](host);
    scrolls.forEach(([key, left]) => {const e = host.querySelector(`[data-scroll="${key}"]`);if (e) e.scrollLeft = left;});
    if (focusKey) {
      const controls=[...host.querySelectorAll('[data-control]')],target=controls.find(e=>e.dataset.control===focusKey),i=controls.indexOf(target);
      const next=target?.disabled?controls.slice(i+1).find(e=>!e.disabled)||controls.slice(0,i).reverse().find(e=>!e.disabled):target;
      next?.focus({preventScroll:true});
    }
  }
  return {
    perNodo(id) {const sim = id === 'board.prog' ? 'sim_jtag' : dati.nodi[id]?.interazione;return supported.has(sim) || chip.ids.includes(sim) ? sim : null;},
    monta(id, parent) {stop(true);active = id;host = element('section', null, parent);if (!states.has(id)) states.set(id, initialState(id));paint();emit();},
    chiudi() {stop(true);host = null;active = null;emit();},
    ferma() {stop(true);paint();emit();},
    istantanea: snapshot,
    cella(i) {if (active === 'sim_lut' && state().function === 'custom') {state().cells[i] ^= 1;commit();}},
    switch(i) {if (active === 'sim_switch') chip.scegliSwitch(state(), i, null);},
    passo(i) {if (active === 'sim_flow') chip.scegliPasso(state(), i, null);},
  };
}
