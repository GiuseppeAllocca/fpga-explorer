import type {Data} from '../data';
import type {SceneSnapshot} from '../simulations/types';

export interface View {scala: number; x: number; y: number}
export interface RenderOptions {animazione?: boolean; inversa?: boolean; daIndirizzo?: boolean; precedente?: string | null}
export interface ExplorerState {
  radice: string;
  selezione: string;
  precedente: string;
  pannelloAperto: boolean;
  foglio: number;
  scheda: string;
  variante: string;
  modo: string;
}
export interface Renderer {
  gruppo: object | null;
  inTransizione: boolean;
  vista: View;
  render(id: string): void;
  seleziona(id: string): void;
  aggiornaSimulazione?(snapshot: SceneSnapshot): void;
  ridimensiona(): void;
  zoom(factor: number, x?: number, y?: number): void;
  applicaVista(): void;
  richiediVista(): void;
  input(): void;
  transizione(id: string, inverse: boolean | undefined, draw: () => void): void | Promise<void>;
}
export interface Model {
  dati: Data;
  stato: ExplorerState;
  inAttesa: {id: string; opzioni: RenderOptions} | null;
  radiceDi(id: string): string;
  render(id: string, options?: RenderOptions): void;
  seleziona(id: string): void;
  selezionaPin(pin: string): void;
  selezionaSwitch(index: number): void;
  selezionaPasso(index: number): void;
  entra(id?: string): void;
  esci(): void;
  barra(): void;
  aperturaPannello(): void;
}
