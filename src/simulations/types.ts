import type {Data} from '../data';
import type {readLut, readWide, carryTrace, timingTrace} from './logic';
import type {ChipId, ChipStates} from './states';

export type ChipSnapshots = {
  [K in ChipId]: {id: K} & ChipStates[K] & (K extends 'sim_tristate' ? {y: string; wire: string} : object)
};
export type ConfigurationSnapshot = ChipSnapshots['sim_jtag'];
export type SnapshotCommon = {
  ffLatch: boolean;
  configuration?: ConfigurationSnapshot;
  editable?: boolean;
  split?: boolean;
  low?: number;
};
export type SimulationSnapshot = SnapshotCommon & (
  | {id: null}
  | ({id: 'sim_lut'; cells: number[]; split: boolean; editable: boolean} & ReturnType<typeof readLut>)
  | {id: 'sim_distram'; address: number; cells: number[]; output: number; blocked: boolean}
  | {id: 'sim_srl'; address: number; cells: number[]; marks: boolean[]; output: number}
  | ({id: 'sim_widemux'; small: boolean; inputs: number[]} & ReturnType<typeof readWide>)
  | ({id: 'sim_carry'; step: number; width: number} & ReturnType<typeof carryTrace>)
  | {id: 'sim_ff_latch'; step: number; trace: ReturnType<typeof timingTrace>}
  | ChipSnapshots[ChipId]
);
export type SceneSnapshot = SimulationSnapshot & {board?: {pin: string | null; digit: number | null}};
export type FocusKey = string | null | undefined;
export interface GridOptions {selected?: number[]; edit?: ((index: number) => void) | null; offset?: number; quarter?: boolean; marks?: boolean[]}
export interface ChipUI {
  dati: Data;
  element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string | number | boolean | null, parent?: Element, className?: string): HTMLElementTagNameMap[K];
  button(text: string | number | boolean, key: string, action: () => void, parent: Element, pressed?: number | boolean): HTMLButtonElement;
  toggle(name: string, value: number, key: string, action: () => void, parent: Element): HTMLButtonElement;
  select(label: string, options: string[][], value: string, key: string, action: (value: string) => void, parent: Element): HTMLSelectElement;
  signal(name: string, value: string | number, parent: Element): HTMLOutputElement;
  grid(cells: number[], columns: number, parent: Element, options?: GridOptions): HTMLDivElement;
  commit(key?: FocusKey): void;
  emit(): void;
  stop(pause?: boolean): void;
  animate(options: {advance: () => boolean; finish: () => void; interval?: number; key: string}): void;
  riduciMovimento(): boolean;
}
