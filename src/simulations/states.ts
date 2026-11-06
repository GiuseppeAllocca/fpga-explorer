import type {Data} from '../data';
import {binary, lutTable, wideTable} from './logic';
import {bitstreamBits, type MemoryWord} from './chip-logic';

export const logicFactories = {
  sim_lut: () => ({inputs: binary(0, 6), cells: lutTable('and'), function: 'and', split: false}),
  sim_widemux: () => ({inputs: binary(0, 8), table: wideTable('parity'), function: 'parity', seed: 0x5eed, small: false, abc: [0, 0, 0] as [number, number, number]}),
  sim_ff_latch: () => ({data: Array<number>(16).fill(0), step: 0, latch: false}),
  sim_distram: () => ({cells: Array<number>(64).fill(0), inputs: binary(0, 6), d: 0, we: 0, blocked: false}),
  sim_srl: () => ({cells: Array<number>(32).fill(0), marks: Array<boolean>(32).fill(false), d: 0, marked: false, address: 0, edges: 0}),
  sim_carry: () => ({a: 0, b: 0, width: 8, step: 0}),
};

export const chipFactories = (dati: Data) => ({
    sim_bram: () => ({cells: Array<MemoryWord>(16).fill(0), ports: [0, 1].map(() => ({address: 0, data: 0, we: 0, mode: 'WRITE_FIRST', output: 0 as MemoryWord})), outputs: [0, 0] as MemoryWord[], collision: null as number | null}),
    sim_tristate: () => ({a: 0, b: 0, en: 1, fpga: 'Z', external: 'Z'}),
    sim_switch: () => ({routes: [] as number[][], source: null as number | null}),
    sim_clock: () => ({mode: 'skew', dedicated: false, n: 1, duty: 50, phase: 0, playing: false}),
    sim_jtag: () => ({test: false, cells: Array<number>(8).fill(0), tdi: 0, tdo: 0, read: [] as number[], progress: 0, done: false, bits: bitstreamBits(dati), loading: false}),
    sim_flow: () => ({step: 0, route: false}),
  });

export type LogicId = keyof typeof logicFactories;
export type ChipId = keyof ReturnType<typeof chipFactories>;
export type SimulationId = LogicId | ChipId;
export type LogicStates = {[K in LogicId]: ReturnType<(typeof logicFactories)[K]>};
export type PlaybackState = {playing?: boolean; loading?: boolean};
export type ChipStates = {[K in ChipId]: ReturnType<ReturnType<typeof chipFactories>[K]> & PlaybackState};
export type SimulationStates = LogicStates & ChipStates;
