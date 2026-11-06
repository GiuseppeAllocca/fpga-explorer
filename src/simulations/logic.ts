// Modelli deterministici: nessun DOM, clock reale o dipendenza dal renderer.
export const bit = (value: unknown) => Number(Boolean(value));
export const address = (bits: number[]) => bits.reduce((n, b, i) => n + bit(b) * 2 ** i, 0);
export const binary = (n: number, width: number) => Array.from({length: width}, (_, i) => Math.floor(n / 2 ** i) % 2);
export const parity = (n: number) => binary(n, 8).reduce((a, b) => a ^ b, 0);

export function lutTable(name: string) {
  return Array.from({length: 64}, (_, a) => {
    if (name === 'and') return bit(a === 63);
    if (name === 'xor') return parity(a);
    if (name === 'mux') return binary(a, 6)[Math.floor(a / 16)];
    return 0;
  });
}

export function readLut(cells: number[], inputs: number[], split = false) {
  const low = address(inputs.slice(0, 5));
  const a = split ? low + 32 : address(inputs);
  return {address: a, low, o5: cells[low], o6: cells[a]};
}

export function wideTable(name: string, seed = 0x5eed) {
  let state = seed >>> 0;
  return Array.from({length: 256}, (_, a) => {
    if (name === 'parity') return parity(a);
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state >>> 31;
  });
}

export function readWide(table: number[], inputs: number[]) {
  const a = address(inputs.slice(0, 6));
  const outputs = [0, 1, 2, 3].map(i => table[i * 64 + a]);
  const f7a = outputs[bit(inputs[6])], f7b = outputs[2 + bit(inputs[6])];
  return {address: address(inputs), local: a, outputs, f7a, f7b, output: inputs[7] ? f7b : f7a, quarter: bit(inputs[6]) + 2 * bit(inputs[7])};
}

export function smallMux(a: number, b: number, c: number) {
  const and = bit(a) & bit(b), or = bit(a) | bit(b);
  return {and, or, output: c ? or : and};
}

export function timingTrace(data: number[]) {
  let ff = 0, latch = 0;
  return data.map((d, i) => {
    const clk = bit(i % 2 === 0);
    if (clk) ff = bit(d);
    else latch = bit(d);
    return {clk, d: bit(d), ff, latch};
  });
}

export function writeRam(cells: number[], a: number, d: number, we: number) {
  const next = cells.slice();
  if (we) next[a] = bit(d);
  return next;
}

export function shiftRegister(cells: number[], marks: boolean[], d: number, marked: boolean) {
  return {cells: [bit(d), ...cells.slice(0, 31)], marks: [Boolean(marked), ...marks.slice(0, 31)]};
}

export function carryTrace(a: number, b: number, width = 8) {
  let carry = 0, sum = 0;
  const stages = Array.from({length: width}, (_, i) => {
    const x = Math.floor(a / 2 ** i) % 2, y = Math.floor(b / 2 ** i) % 2;
    const cin = carry, p = x ^ y, g = x & y, q = p ^ cin;
    carry = p ? cin : g;
    sum += q * 2 ** i;
    return {index: i, a: x, b: y, cin, cout: carry, q};
  });
  return {stages, sum, cout: carry, result: sum + carry * 2 ** width};
}
