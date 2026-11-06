import {describe, expect, it} from 'vitest';
import dati from '../src/data/fpga.json';
import * as logic from '../src/simulations/chip-logic.ts';

const {bramEdge, tristateAnd, resolvePin, routeBetween, divider, shiftBoundary, bitstreamBits} = logic;
const modes = ['WRITE_FIRST', 'READ_FIRST', 'NO_CHANGE'];
const memory = () => Object.freeze(Array.from({length: 16}, (_, i) => i * 17));
const port = (address, data = 0, we = false, mode = 'WRITE_FIRST', output = 0) => Object.freeze({address, data, we, mode, output});
const expectedOutput = (mode, data, before, previous) => ({WRITE_FIRST: data, READ_FIRST: before, NO_CHANGE: previous})[mode];

describe('modelli del chip', () => {
  it('espone soltanto le sette funzioni concordate', () => {
    expect(Object.keys(logic).sort()).toEqual(['bramEdge', 'tristateAnd', 'resolvePin', 'routeBetween', 'divider', 'shiftBoundary', 'bitstreamBits'].sort());
  });
});

describe('block RAM a due porte', () => {
  it('legge tutti gli indirizzi di entrambe le porte da memoria prefronte senza mutarla', () => {
    const cells = memory();
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) for (const mode of modes) {
      const result = bramEdge(cells, Object.freeze([port(a, 255, false, mode, 7), port(b, 0, false, mode, 9)]));
      expect(result).toEqual({cells: Array.from({length: 16}, (_, i) => i * 17), outputs: [a * 17, b * 17], collision: null});
      expect(result.cells).not.toBe(cells);
    }
  });

  it('applica tutti i modi di scrittura a ciascuna porta e preserva le celle non scritte', () => {
    for (const mode of modes) for (const writingPort of [0, 1]) for (let address = 0; address < 16; address++) for (const data of [0, 255]) {
      const cells = memory(), other = (address + 1) % 16;
      const ports = [port(other), port(other)];ports[writingPort] = port(address, data, true, mode, 73);
      const result = bramEdge(cells, Object.freeze(ports));
      expect(result.cells).toEqual(cells.map((value, i) => i === address ? data : value));
      expect(result.outputs[writingPort]).toBe(expectedOutput(mode, data, address * 17, 73));
      expect(result.outputs[1 - writingPort]).toBe(other * 17);
      expect(result.collision).toBeNull();
    }
  });

  it('scrive simultaneamente su indirizzi distinti senza dipendere dall’ordine delle porte', () => {
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
      if (a === b) continue;
      const cells = memory(), ports = [port(a, 0, true, 'READ_FIRST'), port(b, 255, true, 'NO_CHANGE', 8)];
      const result = bramEdge(cells, ports), reverse = bramEdge(cells, ports.toReversed());
      expect(result.cells).toEqual(cells.map((value, i) => i === a ? 0 : i === b ? 255 : value));
      expect(result).toMatchObject({outputs: [a * 17, 8], collision: null});
      expect(reverse.cells).toEqual(result.cells);expect(reverse.outputs).toEqual(result.outputs.toReversed());
    }
  });

  it('segnala dati discordanti sullo stesso indirizzo mantenendo le regole delle uscite', () => {
    for (let address = 0; address < 16; address++) for (const modeA of modes) for (const modeB of modes) {
      const cells = memory();
      const result = bramEdge(cells, Object.freeze([port(address, 88, true, modeA, 6), port(address, 89, true, modeB, 7)]));
      expect(result.cells).toEqual(cells.map((value, i) => i === address ? '?' : value));
      expect(result.collision).toBe(address);
      expect(result.outputs).toEqual([expectedOutput(modeA, 88, address * 17, 6), expectedOutput(modeB, 89, address * 17, 7)]);
    }
  });

  it('considera valide due scritture identiche e consente di riscrivere una cella incerta', () => {
    for (const modeA of modes) for (const modeB of modes) {
      const result = bramEdge(memory(), [port(0, 42, true, modeA, 6), port(0, 42, true, modeB, 7)]);
      expect(result.collision).toBeNull();expect(result.cells[0]).toBe(42);
      expect(result.outputs).toEqual([expectedOutput(modeA, 42, 0, 6), expectedOutput(modeB, 42, 0, 7)]);
    }
    const uncertain = bramEdge(memory(), [port(15, 0, true), port(15, 1, true)]).cells;
    const recovered = bramEdge(uncertain, [port(15, 255, true, 'READ_FIRST'), port(0)]);
    expect(recovered.outputs).toEqual(['?', 0]);expect(recovered.cells[15]).toBe(255);expect(recovered.collision).toBeNull();
    expect(uncertain[15]).toBe('?');
  });

  it('rifiuta indirizzi, byte, modi o dimensioni fuori dal modello', () => {
    for (const invalid of [port(-1), port(16), port(0.5), port(0, -1), port(0, 256), port(0, 0, true, 'assente')]) {
      expect(() => bramEdge(memory(), [invalid, port(1)])).toThrow(RangeError);
    }
    expect(() => bramEdge(Array(15).fill(0), [port(0), port(1)])).toThrow(RangeError);
    expect(() => bramEdge(memory(), [port(0)])).toThrow(RangeError);
  });
});

describe('tri-state e risoluzione del pin', () => {
  it('verifica esaustivamente AND e abilitazione', () => {
    const expected = ['Z', 'Z', 'Z', 'Z', '0', '0', '0', '1'];
    for (let inputs = 0; inputs < 8; inputs++) expect(tristateAnd(inputs & 1, (inputs >> 1) & 1, (inputs >> 2) & 1)).toBe(expected[inputs]);
  });
  it('verifica tutte le coppie di driver e distingue alta impedenza da conflitto', () => {
    const values = ['0', '1', 'Z'], expected = [['0', 'X', '0'], ['X', '1', '1'], ['0', '1', 'Z']];
    values.forEach((a, i) => values.forEach((b, j) => expect(resolvePin(a, b)).toBe(expected[i][j])));
  });
});

describe('routing nella griglia', () => {
  it('verifica tutte le 256 coppie, estremi, lunghezza minima e precedenza orizzontale', () => {
    for (let start = 0; start < 16; start++) for (let end = 0; end < 16; end++) {
      const route = routeBetween(start, end), x0 = start % 4, y0 = Math.floor(start / 4), x1 = end % 4, y1 = Math.floor(end / 4);
      const horizontal = Math.abs(x1 - x0), vertical = Math.abs(y1 - y0);
      expect(route[0]).toBe(start);expect(route.at(-1)).toBe(end);expect(route).toHaveLength(horizontal + vertical + 1);
      expect(new Set(route).size).toBe(route.length);
      route.forEach((cell, i) => {
        expect(cell).toBeGreaterThanOrEqual(0);expect(cell).toBeLessThan(16);
        if (i <= horizontal) {expect(Math.floor(cell / 4)).toBe(y0);expect(cell % 4).toBe(x0 + Math.sign(x1 - x0) * i);}
        else {expect(cell % 4).toBe(x1);expect(Math.floor(cell / 4)).toBe(y0 + Math.sign(y1 - y0) * (i - horizontal));}
      });
    }
  });
  it('rifiuta coordinate esterne alla griglia e indici frazionari', () => {
    for (const invalid of [-1, 16, 1.5, NaN]) {
      expect(() => routeBetween(invalid, 0)).toThrow(RangeError);expect(() => routeBetween(0, invalid)).toThrow(RangeError);
    }
  });
});

describe('divisore del clock', () => {
  it.each([
    [1, 20, 50_000_000, '20 ns', '50 MHz'],
    [50, 1000, 1_000_000, '1 µs', '1 MHz'],
    [50_000, 1_000_000, 1000, '1 ms', '1 kHz'],
    [1_000_000, 20_000_000, 50, '20 ms', '50 Hz'],
  ])('calcola periodo completo e frequenza per N = %s', (n, periodNs, frequencyHz, periodText, frequencyText) => {
    expect(divider(n)).toEqual({periodNs, frequencyHz, periodText, frequencyText});
  });
  it('conserva la precisione numerica e segnala i testi arrotondati con separatore italiano', () => {
    const result = divider(3);
    expect(result.periodNs).toBe(60);expect(result.frequencyHz).toBe(50_000_000 / 3);
    expect(result.frequencyText).toBe('≈ 16,666667 MHz');
    expect(divider(51).periodText).toBe('1,02 µs');expect(divider(50_001).periodText).toBe('1,00002 ms');
    for (const n of [2, 3, 49, 50, 51, 49_999, 50_000, 50_001, 999_999, 1_000_000]) {
      const value = divider(n);expect(value.periodNs * value.frequencyHz).toBeCloseTo(1_000_000_000, 5);
      expect(value.frequencyHz).toBeGreaterThanOrEqual(50);expect(value.frequencyHz).toBeLessThanOrEqual(50_000_000);
    }
  });
  it('accetta solo N intero fra uno e un milione', () => {
    for (const n of [0, -1, 1_000_001, 0.5, Infinity, NaN, '1', null, undefined]) expect(() => divider(n)).toThrow(RangeError);
  });
});

describe('boundary scan e dimensione del bitstream', () => {
  it('inserisce TDI in testa ed emette esattamente i precedenti bit di coda su TDO', () => {
    const initial = Object.freeze([1, 0, 1, 1, 0, 0, 1, 0]);
    let cells = initial;const output = [];
    for (let edge = 0; edge < initial.length; edge++) {
      const before = cells, next = shiftBoundary(cells, edge % 2);
      output.push(next.tdo);expect(next.cells).toHaveLength(initial.length);expect(next.cells[0]).toBe(edge % 2);
      expect(next.cells.slice(1)).toEqual(before.slice(0, -1));expect(next.cells).not.toBe(before);cells = next.cells;
    }
    expect(output).toEqual([0, 1, 0, 0, 1, 1, 0, 1]);expect(initial).toEqual([1, 0, 1, 1, 0, 0, 1, 0]);
    expect(shiftBoundary([1], 0)).toEqual({cells: [0], tdo: 1});expect(() => shiftBoundary([], 0)).toThrow(RangeError);
  });
  it('legge il numero del dispositivo dal JSON e segue variazioni del dato anziché una costante', () => {
    expect(bitstreamBits(dati)).toBe(30_606_304);
    const changed = structuredClone(dati), rows = changed.nodi.configurazione.numeri;
    rows.find(row => row.voce.includes('XC7A100T')).valore = '12 345 678 bit (circa 1,5 MB)';rows.reverse();
    expect(bitstreamBits(changed)).toBe(12_345_678);expect(bitstreamBits(dati)).toBe(30_606_304);
    rows.find(row => row.voce.includes('XC7A100T')).valore = 'dato assente';
    expect(() => bitstreamBits(changed)).toThrow('Dimensione del bitstream');
    expect(() => bitstreamBits({nodi: {configurazione: {numeri: []}}})).toThrow('Dimensione del bitstream');
  });
});
