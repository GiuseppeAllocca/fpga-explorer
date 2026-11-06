import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import dati from '../src/data/fpga.json';
import {creaSimulazioni} from '../src/simulations/panel.ts';

// DOM minimo per il controller: non verifica layout, focus del browser o accessibilità.
class Element {
  constructor(tag) {
    this.tag = tag;this.children = [];this.dataset = {};this.attributes = {};this.events = {};
    this.className = '';this.scrollLeft = 0;this.text = '';this.disabled = false;
    this.style = {setProperty() {}};
    const tokens = () => this.className.split(/\s+/).filter(Boolean);
    this.classList = {
      add: (...names) => {this.className = [...new Set([...tokens(), ...names])].join(' ');},
      remove: (...names) => {this.className = tokens().filter(name => !names.includes(name)).join(' ');},
      contains: name => tokens().includes(name),
      toggle: (name, force) => {
        const enabled = force ?? !tokens().includes(name);
        this.classList[enabled ? 'add' : 'remove'](name);return enabled;
      },
    };
  }
  set textContent(value) {this.text = String(value);this.children = [];}
  get textContent() {return this.text + this.children.map(child => child.textContent).join('');}
  append(...children) {this.children.push(...children);}
  replaceChildren(...children) {this.text = '';this.children = children;}
  setAttribute(name, value) {this.attributes[name] = String(value);}
  getAttribute(name) {
    if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? null;
    return this.attributes[name] ?? this[name] ?? null;
  }
  addEventListener(type, action) {(this.events[type] ??= []).push(action);}
  dispatchEvent(event) {(this.events[event.type] ?? []).forEach(action => action({...event, target: this}));}
  click() {if (!this.disabled) this.dispatchEvent({type: 'click'});}
  focus() {document.activeElement = this;}
  checkValidity() {
    if (this.type !== 'number' || this.value === '') return true;
    const value = Number(this.value);
    return Number.isFinite(value) && value >= Number(this.min) && value <= Number(this.max)
      && (value - Number(this.min)) % Number(this.step) === 0;
  }
  reportValidity() {return this.checkValidity();}
  matches(selector) {
    const match = selector.match(/^([a-z][\w-]*)?(?:\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\])?$/);
    if (!match) throw Error(`Selettore non supportato dal DOM di test: ${selector}`);
    const [, tag, className, attribute, value] = match;
    return (!tag || this.tag === tag) && (!className || this.classList.contains(className))
      && (!attribute || (value === undefined ? this.getAttribute(attribute) !== null : this.getAttribute(attribute) === value));
  }
  querySelectorAll(selector) {return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);}
  querySelector(selector) {return this.querySelectorAll(selector)[0] ?? null;}
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('document', {createElement: tag => new Element(tag), createElementNS: (_namespace, tag) => new Element(tag), activeElement: null});
});
afterEach(() => {vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});

function setup(id, reducedMotion = false) {
  const cambiato = vi.fn(), parent = document.createElement('div');
  const api = creaSimulazioni({dati, cambiato, riduciMovimento: () => reducedMotion});
  api.monta(id, parent);
  const control = key => {
    const element = parent.querySelector(`[data-control="${key}"]`);
    if (!element) throw Error(`Controllo assente: ${key}`);
    return element;
  };
  const set = (key, value, type = 'change') => {const e = control(key);e.value = value;e.dispatchEvent({type});};
  const signal = name => parent.querySelector(`[data-signal="${name}"]`).querySelector('strong').textContent;
  return {api, parent, cambiato, control, set, signal};
}

describe('controller delle simulazioni', () => {
  it('associa i sei nodi supportati e rende i controlli di ciascuna simulazione', () => {
    const nodes = [['lut', 'sim_lut'], ['slice.mux', 'sim_widemux'], ['slice.ff', 'sim_ff_latch'],
      ['lut.distram', 'sim_distram'], ['lut.srl', 'sim_srl'], ['slice.carry', 'sim_carry']];
    for (const [node, id] of nodes) {
      const {api, control, cambiato} = setup(id);
      expect(api.perNodo(node)).toBe(id);
      expect(api.perNodo('board')).toBeNull();expect(api.perNodo('assente')).toBeNull();
      expect(control('reset').textContent).toBe('Ricomincia');
      expect(cambiato).toHaveBeenLastCalledWith(api.istantanea());
      api.chiudi();
    }
  });

  it('modifica le celle LUT solo in modalità personalizzata e blocca A6 in split', () => {
    const {api, control, set, signal} = setup('sim_lut');
    api.cella(3);expect(api.istantanea().cells[3]).toBe(0);
    set('function', 'custom');api.cella(3);
    control('a0').click();control('a1').click();
    expect(api.istantanea()).toMatchObject({address: 3, o6: 1, editable: true});
    expect(signal('O6')).toBe('1');
    control('split').click();
    expect(control('a5').disabled).toBe(true);
    expect(api.istantanea()).toMatchObject({address: 35, low: 3, o5: 1, split: true});
    control('a5').click();expect(api.istantanea().address).toBe(35);
    control('reset').click();expect(api.istantanea()).toMatchObject({address: 0, split: false, editable: false});
  });

  it('avanza il carry ogni 250 ms, attraversa le slice e si ferma alla larghezza scelta', () => {
    const {api, control, set, signal, parent} = setup('sim_carry');
    set('a-number', '255', 'input');set('b-number', '1', 'input');
    control('carry-step').click();expect(api.istantanea().step).toBe(1);
    expect(parent.querySelectorAll('.done')).toHaveLength(1);
    control('play').click();expect(vi.getTimerCount()).toBe(1);
    expect(control('play').textContent).toBe('Pausa');
    vi.advanceTimersByTime(249);expect(api.istantanea().step).toBe(1);
    vi.advanceTimersByTime(1);expect(api.istantanea().step).toBe(2);
    vi.advanceTimersByTime(1500);
    expect(api.istantanea()).toMatchObject({step: 8, result: 256});
    expect(vi.getTimerCount()).toBe(0);expect(control('carry-step').disabled).toBe(true);
    expect(parent.querySelectorAll('.done')).toHaveLength(8);
    expect(parent.querySelectorAll('.crossed')).toHaveLength(1);
    expect(signal('slice attraversate')).toBe('2');expect(signal('A + B')).toBe('256');
    control('play').click();expect(api.istantanea().step).toBe(0);
    control('reset').click();expect(vi.getTimerCount()).toBe(0);
    expect(api.istantanea()).toMatchObject({step: 0, result: 0});
  });

  it.each(['chiudi', 'ferma'])('rimuove il timer con %s senza ulteriori cambiamenti', method => {
    const {api, control, parent, cambiato} = setup('sim_carry');
    control('play').click();vi.advanceTimersByTime(250);
    api[method]();const calls = cambiato.mock.calls.length;
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(2000);expect(cambiato).toHaveBeenCalledTimes(calls);
    if (method === 'chiudi') {
      expect(api.istantanea().id).toBeNull();parent.replaceChildren();api.monta('sim_carry', parent);
    }
    expect(api.istantanea().step).toBe(1);
    expect(parent.querySelector('section').classList.contains('running')).toBe(false);
  });

  it('interrompe il playback precedente quando monta un’altra simulazione', () => {
    const {api, control, cambiato} = setup('sim_ff_latch');
    control('play').click();vi.advanceTimersByTime(250);
    api.monta('sim_distram', document.createElement('div'));
    const calls = cambiato.mock.calls.length;
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);expect(cambiato).toHaveBeenCalledTimes(calls);
    expect(api.istantanea().id).toBe('sim_distram');
  });

  it('campiona D, conserva la configurazione latch e termina il playback a 16', () => {
    const {api, control, set, cambiato} = setup('sim_ff_latch');
    control('d-0').click();control('d-1').click();set('ff-mode', 'latch');
    expect(api.istantanea().trace.slice(0, 3)).toEqual([
      {clk: 1, d: 1, ff: 1, latch: 0}, {clk: 0, d: 1, ff: 1, latch: 1}, {clk: 1, d: 0, ff: 0, latch: 1},
    ]);
    control('play').click();vi.advanceTimersByTime(3750);
    expect(api.istantanea().step).toBe(15);expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(250);
    expect(api.istantanea()).toMatchObject({step: 16, ffLatch: true});expect(vi.getTimerCount()).toBe(0);
    const calls = cambiato.mock.calls.length;
    vi.advanceTimersByTime(1000);expect(cambiato).toHaveBeenCalledTimes(calls);
    control('step').click();expect(api.istantanea().step).toBe(0);
    api.chiudi();expect(api.istantanea()).toEqual({id: null, ffLatch: true});
  });

  it.each([['sim_carry', 8], ['sim_ff_latch', 16]])('completa %s senza timer con reduced motion', (id, total) => {
    const {api, control, cambiato} = setup(id, true);
    control('play').click();expect(api.istantanea().step).toBe(total);
    expect(vi.getTimerCount()).toBe(0);
    expect(cambiato).toHaveBeenLastCalledWith(api.istantanea());
    expect(control('play').textContent).toBe(id === 'sim_carry' ? 'Esegui tutto' : 'Riproduci');
  });

  it('scrive la RAM solo al clock con WE e legge subito al cambio di indirizzo', () => {
    const {api, control, signal} = setup('sim_distram');
    control('ram-d').click();control('ram-clock').click();
    expect(api.istantanea()).toMatchObject({output: 0, blocked: true});
    control('ram-we').click();expect(api.istantanea().output).toBe(0);
    control('ram-clock').click();expect(api.istantanea()).toMatchObject({output: 1, blocked: false});
    control('ram-d').click();expect(api.istantanea().output).toBe(1);
    control('ram-clock').click();expect(api.istantanea().output).toBe(0);
    control('ram-a0').click();control('ram-d').click();control('ram-clock').click();
    expect(api.istantanea()).toMatchObject({address: 1, output: 1});
    control('ram-a0').click();expect(signal('Q')).toBe('0');
    control('ram-a0').click();expect(signal('Q')).toBe('1');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('porta il bit SRL marcato alla posizione scelta al fronte previsto e lo azzera con reset', () => {
    const {api, control, set, signal} = setup('sim_srl');
    set('srl-address', '2', 'input');expect(signal('lunghezza = indirizzo + 1')).toBe('3');
    control('srl-d').click();control('mark').click();control('srl-clock').click();
    expect(api.istantanea().marks[0]).toBe(true);expect(api.istantanea().output).toBe(0);
    control('srl-d').click();control('srl-clock').click();
    expect(api.istantanea().marks[1]).toBe(true);expect(api.istantanea().output).toBe(0);
    control('srl-clock').click();
    expect(api.istantanea().marks[2]).toBe(true);expect(signal('Q')).toBe('1 ★');expect(signal('fronti')).toBe('3');
    control('srl-clock').click();expect(signal('Q')).toBe('0');expect(signal('fronti')).toBe('4');
    control('reset').click();
    expect(api.istantanea().cells).toEqual(Array(32).fill(0));expect(api.istantanea().marks).toEqual(Array(32).fill(false));
    expect(api.istantanea().address).toBe(0);expect(signal('fronti')).toBe('0');
  });
});

describe('controller delle simulazioni del chip', () => {
  it('associa i sei controller e gli alias dei nodi tramite il controller principale', () => {
    const {api, parent, cambiato} = setup('sim_bram');
    expect(api.istantanea().configuration).toBeUndefined();
    for (const [node, id] of [['bram', 'sim_bram'], ['iob', 'sim_tristate'], ['interconnessione', 'sim_switch'],
      ['board.clock', 'sim_clock'], ['configurazione', 'sim_jtag'], ['flusso', 'sim_flow'],
      ['cmt', 'sim_clock'], ['regione.hrow', 'sim_clock'], ['clb.switch', 'sim_switch'], ['board.prog', 'sim_jtag']]) {
      expect(api.perNodo(node)).toBe(id);parent.replaceChildren();api.monta(api.perNodo(node), parent);
      expect(api.istantanea().id).toBe(id);expect(parent.querySelector('[data-control="reset"]')).not.toBeNull();
      expect(cambiato).toHaveBeenLastCalledWith(api.istantanea());
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('applica WE e i tre modi BRAM al fronte, rileva la collisione all’indirizzo zero e ripristina la memoria', () => {
    const {api, control, set, parent} = setup('sim_bram');
    set('bram-address-1', '15', 'input');set('bram-data-0', '171', 'input');
    control('bram-clock').click();expect(api.istantanea()).toMatchObject({outputs: [0, 0], collision: null});
    expect(api.istantanea().cells).toEqual(Array(16).fill(0));
    control('bram-we-0').click();expect(api.istantanea().cells[0]).toBe(0);
    control('bram-clock').click();expect(api.istantanea().outputs).toEqual([171, 0]);
    set('bram-data-0', '205', 'input');expect(api.istantanea().outputs[0]).toBe(171);
    control('bram-clock').click();expect(api.istantanea()).toMatchObject({outputs: [205, 0]});
    set('bram-mode-0', 'READ_FIRST');set('bram-data-0', '17', 'input');control('bram-clock').click();
    expect(api.istantanea().cells[0]).toBe(17);expect(api.istantanea().outputs[0]).toBe(205);
    set('bram-mode-0', 'NO_CHANGE');set('bram-data-0', '99', 'input');control('bram-clock').click();
    expect(api.istantanea().cells[0]).toBe(99);expect(api.istantanea().outputs[0]).toBe(205);
    set('bram-address-1', '0', 'input');set('bram-data-1', '100', 'input');control('bram-we-1').click();control('bram-clock').click();
    expect(api.istantanea()).toMatchObject({collision: 0, outputs: [205, 100]});expect(api.istantanea().cells[0]).toBe('?');
    expect(parent.querySelector('[role="status"]').textContent).toBe('collisione: valore non determinato');
    expect(parent.querySelector('[data-address="0"]').textContent).toBe('????????');
    control('reset').click();
    expect(api.istantanea()).toMatchObject({cells: Array(16).fill(0), outputs: [0, 0], collision: null});
    expect(api.istantanea().ports.every(p => p.we === 0 && p.mode === 'WRITE_FIRST')).toBe(true);
    expect(parent.querySelector('[role="status"]')).toBeNull();
  });

  it('mostra alta impedenza, AND abilitata e conflitto fra driver', () => {
    const {api, control, set, signal, parent} = setup('sim_tristate');
    expect(signal('Y')).toBe('0');expect(signal('Pin')).toBe('Z');
    control('tri-a').click();control('tri-b').click();expect(signal('Y')).toBe('1');
    control('tri-en').click();expect(api.istantanea().y).toBe('Z');expect(signal('Y')).toBe('Z');
    set('pin-fpga', '1');set('pin-external', '0');
    expect(api.istantanea().wire).toBe('X');expect(signal('Pin')).toBe('X');
    expect(parent.querySelector('[role="status"]').textContent).toBe('conflitto');
    set('pin-external', 'Z');expect(signal('Pin')).toBe('1');expect(parent.querySelector('[role="status"]')).toBeNull();
    set('pin-fpga', 'Z');expect(signal('Pin')).toBe('Z');
  });

  it('costruisce percorsi dai controlli e dall’API, conserva gli ultimi tre e conta le switch matrix distinte', () => {
    const {api, control, signal} = setup('sim_switch');
    control('route-0').click();expect(api.istantanea().source).toBe(0);expect(control('route-0').getAttribute('aria-pressed')).toBe('true');
    control('route-3').click();expect(api.istantanea().routes).toEqual([[0, 1, 2, 3]]);expect(signal('switch matrix attraversate')).toBe('4');
    expect(control('route-2').querySelector('.chip-route-matrix').dataset.entryClb).toBe('1');
    api.switch(0);api.switch(12);expect(signal('switch matrix attraversate')).toBe('7');
    control('route-15').click();control('route-12').click();expect(signal('switch matrix attraversate')).toBe('10');
    api.switch(5);api.switch(6);
    expect(api.istantanea()).toMatchObject({routes: [[0, 4, 8, 12], [15, 14, 13, 12], [5, 6]], source: null});
    expect(signal('switch matrix attraversate')).toBe('9');
    api.switch(7);control('routes-clear').click();
    expect(api.istantanea()).toMatchObject({routes: [], source: null});expect(signal('switch matrix attraversate')).toBe('0');
  });

  it('aggiorna N fino a un milione senza ricreare il campo, rifiuta input invalidi e visualizza il duty cycle', () => {
    const {api, control, set, signal} = setup('sim_clock');
    control('clock-mode-divider').click();const input = control('clock-n');
    set('clock-n', '1000000', 'input');
    expect(control('clock-n')).toBe(input);expect(api.istantanea().n).toBe(1_000_000);
    expect(signal('periodo')).toBe('20 ms');expect(signal('frequenza')).toBe('50 Hz');expect(control('clock-n-range').value).toBe('6');
    for (const invalid of ['', '0', '1000001', '1.5']) {
      set('clock-n', invalid, 'input');expect(input.getAttribute('aria-invalid')).toBe('true');expect(api.istantanea().n).toBe(1_000_000);
      expect(signal('periodo')).toBe('20 ms');
    }
    set('clock-n', '50', 'input');expect(input.getAttribute('aria-invalid')).toBe('false');expect(signal('periodo')).toBe('1 µs');
    set('clock-n-range', '6', 'input');expect(control('clock-n').value).toBe('1000000');expect(signal('frequenza')).toBe('50 Hz');
    control('clock-mode-duty').click();
    for (const duty of [10, 75, 90]) {
      set('clock-duty', String(duty), 'input');expect(api.istantanea().duty).toBe(duty);expect(signal('Duty cycle')).toBe(duty + '%');
      expect(control('clock-duty').getAttribute('aria-valuetext')).toBe(duty + '%');
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('conclude il playback del clock e interrompe l’animazione quando cambia la rete', () => {
    const {api, control} = setup('sim_clock');
    control('clock-play').click();vi.advanceTimersByTime(3750);
    expect(api.istantanea()).toMatchObject({phase: 15, playing: true});expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(250);expect(api.istantanea()).toMatchObject({phase: 16, playing: false});expect(vi.getTimerCount()).toBe(0);
    control('clock-play').click();vi.advanceTimersByTime(250);control('clock-dedicated').click();
    expect(api.istantanea()).toMatchObject({phase: 0, playing: false, dedicated: true});expect(vi.getTimerCount()).toBe(0);
  });

  it('abilita TCK solo in collaudo e fa attraversare agli otto bit la catena fino a TDO', () => {
    const {api, control, signal, parent} = setup('sim_jtag');
    expect(control('jtag-tck').disabled).toBe(true);expect(control('jtag-tdi').disabled).toBe(true);
    control('jtag-tck').click();expect(api.istantanea().read).toEqual([]);
    expect(parent.querySelectorAll('rect').filter(e => e.getAttribute('class').includes('chip-cell'))).toHaveLength(8);
    control('jtag-mode-true').click();expect(control('jtag-tck').disabled).toBe(false);
    const bits = [1, 0, 1, 1, 0, 0, 1, 0];
    for (const bit of bits) {if (api.istantanea().tdi !== bit) control('jtag-tdi').click();control('jtag-tck').click();}
    expect(api.istantanea().cells).toEqual([0, 1, 0, 0, 1, 1, 0, 1]);expect(api.istantanea().read).toEqual(Array(8).fill(0));
    for (let i = 0; i < 8; i++) control('jtag-tck').click();
    expect(api.istantanea().read.slice(8)).toEqual(bits);expect(api.istantanea().cells).toEqual(Array(8).fill(0));
    expect(signal('letti da TDO')).toBe([...Array(8).fill(0), ...bits].join(' '));
    control('jtag-mode-false').click();control('jtag-tck').click();expect(api.istantanea().read).toHaveLength(16);
  });

  it('carica il bitstream ogni 100 ms del 5%, conclude in due secondi e gestisce spegnimento, flash e reset', () => {
    const {api, control, signal} = setup('sim_jtag');
    control('bitstream-load').click();expect(api.istantanea()).toMatchObject({progress: 0, done: false, loading: true});
    vi.advanceTimersByTime(99);expect(api.istantanea().progress).toBe(0);
    vi.advanceTimersByTime(1);expect(api.istantanea().progress).toBe(5);
    vi.advanceTimersByTime(1800);expect(api.istantanea()).toMatchObject({progress: 95, done: false, loading: true});
    vi.advanceTimersByTime(99);expect(signal('DONE')).toBe('0');
    vi.advanceTimersByTime(1);expect(api.istantanea()).toMatchObject({progress: 100, done: true, loading: false});
    expect(signal('Bitstream')).toBe('100%');expect(signal('DONE')).toBe('1');expect(vi.getTimerCount()).toBe(0);
    control('bitstream-off').click();expect(api.istantanea()).toMatchObject({progress: 0, done: false, loading: false});
    expect(signal('DONE')).toBe('0');control('bitstream-flash').click();vi.advanceTimersByTime(2000);
    expect(api.istantanea()).toMatchObject({progress: 100, done: true, loading: false});
    control('bitstream-load').click();vi.advanceTimersByTime(100);control('reset').click();
    expect(api.istantanea()).toMatchObject({progress: 0, done: false, loading: false, cells: Array(8).fill(0), read: []});
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['chiudi', 'ferma', 'monta'])('ferma il caricamento con %s e conserva la configurazione senza flag attivi', method => {
    const {api, control, parent, cambiato} = setup('sim_jtag');
    control('bitstream-load').click();vi.advanceTimersByTime(100);
    if (method === 'monta') {parent.replaceChildren();api.monta('sim_lut', parent);} else api[method]();
    expect(vi.getTimerCount()).toBe(0);
    expect(api.istantanea().configuration).toMatchObject({id: 'sim_jtag', progress: 5, done: false, loading: false});
    const calls = cambiato.mock.calls.length;vi.advanceTimersByTime(3000);expect(cambiato).toHaveBeenCalledTimes(calls);
    parent.replaceChildren();api.monta('sim_jtag', parent);
    expect(api.istantanea()).toMatchObject({progress: 5, done: false, loading: false});expect(vi.getTimerCount()).toBe(0);
    control('bitstream-load').click();vi.advanceTimersByTime(2000);api.chiudi();
    expect(api.istantanea()).toMatchObject({id: null, configuration: {progress: 100, done: true, loading: false}});
    parent.replaceChildren();api.monta('sim_tristate', parent);
    expect(api.istantanea()).toMatchObject({id: 'sim_tristate', configuration: {progress: 100, done: true}});
  });

  it('completa clock e bitstream con reduced motion senza creare timer', () => {
    const {api, control, parent} = setup('sim_clock', true);
    control('clock-play').click();expect(api.istantanea()).toMatchObject({phase: 16, playing: false});expect(vi.getTimerCount()).toBe(0);
    expect(api.istantanea().configuration).toBeUndefined();
    parent.replaceChildren();api.monta('sim_jtag', parent);control('bitstream-load').click();
    expect(api.istantanea()).toMatchObject({progress: 100, done: true, loading: false, configuration: {progress: 100, done: true}});
    expect(vi.getTimerCount()).toBe(0);control('bitstream-off').click();control('bitstream-flash').click();
    expect(api.istantanea()).toMatchObject({progress: 100, done: true, loading: false});expect(vi.getTimerCount()).toBe(0);
  });

  it('riporta i sette passi verbatim, limita la navigazione e distingue Place e Route con controlli e API', () => {
    const {api, control, parent, cambiato} = setup('sim_flow'), steps = dati.nodi.flusso.passi;
    expect(steps).toHaveLength(7);expect(control('flow-prev').disabled).toBe(true);
    control('flow-prev').click();expect(api.istantanea().step).toBe(0);
    for (let index = 0; index < steps.length; index++) {
      control('flow-' + index).click();expect(api.istantanea().step).toBe(index);
      expect(control('flow-' + index).textContent).toBe(steps[index].nome);
      expect(control('flow-' + index).getAttribute('aria-current')).toBe('step');
      expect(parent.querySelector('h3').textContent).toBe(steps[index].nome);
      expect(parent.querySelectorAll('p').some(e => e.textContent === steps[index].testo)).toBe(true);
    }
    expect(control('flow-next').disabled).toBe(true);control('flow-next').click();expect(api.istantanea().step).toBe(6);
    const calls = cambiato.mock.calls.length;
    for (const invalid of [-1, 7, 1.5]) api.passo(invalid);
    expect(api.istantanea().step).toBe(6);expect(cambiato).toHaveBeenCalledTimes(calls);
    api.passo(4);expect(api.istantanea()).toMatchObject({step: 4, route: false});
    control('flow-route-1').click();expect(api.istantanea().route).toBe(true);
    control('flow-next').click();expect(api.istantanea()).toMatchObject({step: 5, route: false});
    control('flow-prev').click();expect(api.istantanea()).toMatchObject({step: 4, route: false});
    control('flow-route-1').click();control('flow-route-0').click();expect(api.istantanea().route).toBe(false);
    api.passo(0);expect(control('flow-prev').disabled).toBe(true);
  });
});

describe('regressioni di focus e input durante le animazioni', () => {
  it.each([['sim_carry', 'play', 250], ['sim_ff_latch', 'play', 250], ['sim_jtag', 'bitstream-load', 100]])(
    'mantiene il controllo focalizzato durante i tick di %s', (id, key, interval) => {
      const {control} = setup(id);
      control(key).click();const before = control(key);
      expect(document.activeElement).toBe(before);
      vi.advanceTimersByTime(interval);
      expect(control(key)).not.toBe(before);expect(document.activeElement).toBe(control(key));
      control('reset').focus();vi.advanceTimersByTime(interval);
      expect(document.activeElement).toBe(control('reset'));
    },
  );

  it.each([['sim_carry', 'play', 250], ['sim_ff_latch', 'play', 250], ['sim_jtag', 'bitstream-load', 100]])(
    'non sottrae il focus esterno durante i tick di %s', (id, key, interval) => {
      const {control} = setup(id), external = document.createElement('button');
      control(key).click();external.focus();vi.advanceTimersByTime(interval);
      expect(document.activeElement).toBe(external);
    },
  );

  it('mantiene il focus sul comando grafico esterno durante le API switch e passo', () => {
    const {api, parent, control} = setup('sim_switch'), external = document.createElement('button');
    external.focus();api.switch(0);expect(api.istantanea().source).toBe(0);
    expect(document.activeElement).toBe(external);
    api.switch(3);expect(api.istantanea().routes).toEqual([[0, 1, 2, 3]]);expect(document.activeElement).toBe(external);
    parent.replaceChildren();api.monta('sim_flow', parent);api.passo(4);
    expect(api.istantanea().step).toBe(4);expect(document.activeElement).toBe(external);
    expect(control('flow-4').getAttribute('aria-current')).toBe('step');
  });

  it('sposta il focus al comando successivo quando l’ultimo passo carry viene disabilitato', () => {
    const {api, control} = setup('sim_carry');
    for (let i = 0; i < 7; i++) control('carry-step').click();
    expect(api.istantanea().step).toBe(7);control('carry-step').focus();control('carry-step').click();
    expect(api.istantanea().step).toBe(8);expect(control('carry-step').disabled).toBe(true);
    expect(document.activeElement).toBe(control('play'));expect(document.activeElement.disabled).toBe(false);
  });

  it('sposta il focus al comando precedente quando il passo successivo finale del flusso viene disabilitato', () => {
    const {api, control} = setup('sim_flow');
    api.passo(5);control('flow-next').focus();control('flow-next').click();
    expect(api.istantanea().step).toBe(6);expect(control('flow-next').disabled).toBe(true);
    expect(document.activeElement).toBe(control('flow-prev'));expect(document.activeElement.disabled).toBe(false);
  });

  it.each([['a-number', ''], ['a-number', '256'], ['b-number', '-1'], ['b-number', '1.5']])(
    'preserva il draft invalido %s = %s, ferma il timer e richiede una ripresa volontaria', (key, invalid) => {
      const {api, control, set, parent} = setup('sim_carry');
      set('a-number', '12', 'input');set('b-number', '5', 'input');
      control('play').click();vi.advanceTimersByTime(250);expect(api.istantanea().step).toBe(1);
      const input = control(key);input.focus();set(key, invalid, 'input');
      expect(control(key)).toBe(input);expect(input.value).toBe(invalid);expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(input);expect(vi.getTimerCount()).toBe(0);
      expect(parent.querySelector('section').classList.contains('running')).toBe(false);
      expect(control('play').textContent).toBe('Esegui tutto');expect(api.istantanea()).toMatchObject({step: 1, result: 17});
      vi.advanceTimersByTime(1000);expect(api.istantanea().step).toBe(1);expect(input.value).toBe(invalid);
      control('play').click();expect(vi.getTimerCount()).toBe(0);expect(api.istantanea().step).toBe(1);
      set(key, '20', 'input');expect(input.getAttribute('aria-invalid')).toBe('false');
      expect(api.istantanea()).toMatchObject({step: 0, result: key === 'a-number' ? 25 : 32});expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(500);expect(api.istantanea().step).toBe(0);
      control('play').click();expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(250);expect(api.istantanea().step).toBe(1);
    },
  );
});
