import type {FpgaData} from '../data/types';

export type MemoryWord = number | '?';
export interface BramPort {address: number; data: number; we: number; mode: string; output: MemoryWord}

function integer(value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) throw RangeError(`Valore intero richiesto tra ${min} e ${max}`);
}

export function bramEdge(cells: MemoryWord[], ports: BramPort[]) {
  if (cells.length !== 16 || ports.length !== 2) throw RangeError('Sono richieste 16 celle e due porte');
  const outputs = ports.map(({address, data, we, mode, output}) => {
    integer(address, 0, 15);integer(data, 0, 255);
    if (!['WRITE_FIRST', 'READ_FIRST', 'NO_CHANGE'].includes(mode)) throw RangeError('Modo BRAM non valido');
    if (!we || mode === 'READ_FIRST') return cells[address];
    return mode === 'WRITE_FIRST' ? data : output;
  });
  const next = cells.slice();
  for (const port of ports) if (port.we) next[port.address] = port.data;
  const [a, b] = ports;
  const collision = a.we && b.we && a.address === b.address && a.data !== b.data ? a.address : null;
  if (collision !== null) next[collision] = '?';
  return {cells: next, outputs, collision};
}

export function tristateAnd(a: number, b: number, en: number) {
  return en ? (a && b ? '1' : '0') : 'Z';
}

export function resolvePin(a: string, b: string) {
  if (a === 'Z') return b;
  if (b === 'Z') return a;
  return a === b ? a : 'X';
}

export function routeBetween(start: number, end: number) {
  integer(start, 0, 15);integer(end, 0, 15);
  const route = [start];let current = start;
  while (current % 4 !== end % 4) {current += Math.sign(end % 4 - current % 4);route.push(current);}
  while (current !== end) {current += 4 * Math.sign(end - current);route.push(current);}
  return route;
}

function quantity(value: number, unit: string) {
  const text = value.toLocaleString('it-IT', {maximumFractionDigits: 6, useGrouping: false});
  const approximate = Number(text.replace(',', '.')) !== value;
  return `${approximate ? '≈ ' : ''}${text} ${unit}`;
}

export function divider(n: number) {
  integer(n, 1, 1_000_000);
  const periodNs = 20 * n, frequencyHz = 50_000_000 / n;
  const periodText = periodNs >= 1_000_000 ? quantity(periodNs / 1_000_000, 'ms')
    : periodNs >= 1000 ? quantity(periodNs / 1000, 'µs') : quantity(periodNs, 'ns');
  const frequencyText = frequencyHz >= 1_000_000 ? quantity(frequencyHz / 1_000_000, 'MHz')
    : frequencyHz >= 1000 ? quantity(frequencyHz / 1000, 'kHz') : quantity(frequencyHz, 'Hz');
  return {periodNs, frequencyHz, periodText, frequencyText};
}

export function shiftBoundary(cells: number[], tdi: number) {
  if (!cells.length) throw RangeError('La catena deve contenere almeno una cella');
  return {cells: [Number(Boolean(tdi)), ...cells.slice(0, -1)], tdo: cells.at(-1)!};
}

export function bitstreamBits(dati: FpgaData) {
  const row = dati.nodi.configurazione.numeri!.find(item => /\bXC7A100T\b/.test(item.voce));
  const digits = row?.valore.match(/^(\d[\d\s.]*?)\s+bit\b/)?.[1];
  const count = Number(digits?.replace(/[\s.]/g, ''));
  if (!Number.isSafeInteger(count) || count <= 0) throw Error('Dimensione del bitstream XC7A100T assente o non valida');
  return count;
}
