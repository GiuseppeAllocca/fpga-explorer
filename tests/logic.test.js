import {describe, expect, it} from 'vitest';
import {address, binary, lutTable, readLut, wideTable, readWide, smallMux, timingTrace, writeRam, shiftRegister, carryTrace} from '../src/simulations/logic.ts';

describe('LUT e multiplexer', () => {
  it('verifica tutte le 64 combinazioni delle tre funzioni', () => {
    const tables = ['and', 'xor', 'mux'].map(lutTable);
    for (let a = 0; a < 64; a++) {
      const inputs = binary(a, 6);
      expect(address(inputs)).toBe(a);
      const golden = [Number(inputs.every(Boolean)), inputs.filter(Boolean).length % 2, inputs[inputs[4] + 2 * inputs[5]]];
      tables.forEach((table, i) => expect(readLut(table, inputs).o6).toBe(golden[i]));
    }
  });
  it('mantiene indipendenti O5 e O6 con cinque ingressi condivisi', () => {
    const cells = Array.from({length: 64}, (_, i) => i < 32 ? Number(i % 5 < 2) : Number((i - 32) % 7 >= 3));
    for (let a = 0; a < 32; a++) for (const sixth of [0, 1]) {
      const r = readLut(cells, [...binary(a, 5), sixth], true);
      expect(r).toEqual({address: a + 32, low: a, o5: Number(a % 5 < 2), o6: Number(a % 7 >= 3)});
    }
  });
  it('legge anche la funzione personalizzata senza riscrivere la memoria', () => {
    const cells = lutTable('custom');cells[13] = 1;
    expect(readLut(cells, binary(13, 6)).o6).toBe(1);
    expect(readLut(cells, binary(12, 6)).o6).toBe(0);
    expect(cells.filter(Boolean)).toHaveLength(1);
  });
  it('confronta tutti i 256 ingressi con la tabella completa', () => {
    for (const table of [wideTable('parity'), wideTable('random', 42), wideTable('random', 43)]) {
      for (let a = 0; a < 256; a++) {
        const r = readWide(table, binary(a, 8));
        expect(r.output).toBe(table[a]);
        expect(r.outputs[r.quarter]).toBe(table[a]);
      }
    }
    expect(wideTable('random', 42)).toEqual(wideTable('random', 42));
    expect(wideTable('random', 42)).not.toEqual(wideTable('random', 43));
  });
  it('verifica la parità su otto bit e tutti i casi dell’esempio piccolo', () => {
    const table = wideTable('parity');
    for (let a = 0; a < 256; a++) expect(table[a]).toBe(a.toString(2).split('1').length % 2 === 0 ? 1 : 0);
    for (let n = 0; n < 8; n++) {
      const [a, b, c] = binary(n, 3);
      expect(smallMux(a, b, c).output).toBe(Number(a + b + c >= 2));
    }
  });
});

describe('memoria e tempo', () => {
  it('campiona il flip-flop solo sul fronte e il latch solo a clock basso', () => {
    const r = timingTrace([1, 0, 0, 1, 1, 0]);
    expect(r.map(x => x.ff)).toEqual([1, 1, 0, 0, 1, 1]);
    expect(r.map(x => x.latch)).toEqual([0, 0, 0, 1, 1, 0]);
    const a = timingTrace([0, 1, 0, 0]);
    expect(a[1]).toMatchObject({clk: 0, ff: 0, latch: 1});
  });
  it('scrive e cancella tutti gli indirizzi solo con WE e preserva le altre celle', () => {
    for (let a = 0; a < 64; a++) {
      const initial = Array.from({length: 64}, (_, i) => Number(i % 3 === 0));
      expect(writeRam(initial, a, 1 - initial[a], 0)).toEqual(initial);
      const written = writeRam(initial, a, 1, 1);
      expect(written).toEqual(initial.map((cell, i) => i === a ? 1 : cell));
      const cleared = writeRam(written, a, 0, 1);
      expect(cleared).toEqual(initial.map((cell, i) => i === a ? 0 : cell));
      expect(written[a]).toBe(1);
      expect(initial).toEqual(Array.from({length: 64}, (_, i) => Number(i % 3 === 0)));
    }
  });
  it('porta il bit marcato all’uscita esattamente dopo indirizzo + 1 fronti', () => {
    for (let address = 0; address < 32; address++) {
      let cells = Array(32).fill(0), marks = Array(32).fill(false);
      for (let edge = 1; edge <= 33; edge++) {
        ({cells, marks} = shiftRegister(cells, marks, Number(edge === 1), edge === 1));
        expect(Boolean(marks[address])).toBe(edge === address + 1);
        expect(cells[address]).toBe(Number(edge === address + 1));
      }
    }
  });
});

describe('catena di carry', () => {
  it('confronta tutte le 65.536 coppie a otto bit con l’addizione numerica', () => {
    for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) {
      const r = carryTrace(a, b);
      if (r.result !== a + b || r.sum !== (a + b) % 256 || r.cout !== Number(a + b > 255)) throw Error(`${a} + ${b}`);
      for (let i = 0; i < 8; i++) {
        const stage = r.stages[i], base = 2 ** i, nextBase = 2 * base;
        if (stage.index !== i || stage.a !== ((a >>> i) & 1) || stage.b !== ((b >>> i) & 1)
          || stage.q !== Math.floor((a + b) / base) % 2
          || stage.cin !== Number(a % base + b % base >= base)
          || stage.cout !== Number(a % nextBase + b % nextBase >= nextBase)) throw Error(`Stadio ${i}: ${a} + ${b}`);
      }
    }
  });
  it('attraversa i confini delle slice e conserva l’unsigned a 32 bit', () => {
    const r = carryTrace(15, 1);expect(r.stages[4].cin).toBe(1);
    for (const [a, b] of [[255, 255], [0xffffffff, 1], [0x80000000, 0x80000000], [0xffffffff, 0xffffffff]]) {
      const trace = carryTrace(a, b, 32);
      expect(trace.result).toBe(Number(BigInt(a) + BigInt(b)));
      trace.stages.forEach((stage, i) => {
        const base = 2 ** i, nextBase = 2 * base;
        expect(stage).toEqual({index: i, a: (a >>> i) & 1, b: (b >>> i) & 1,
          q: Math.floor((a + b) / base) % 2,
          cin: Number(a % base + b % base >= base), cout: Number(a % nextBase + b % nextBase >= nextBase)});
      });
    }
  });
});
