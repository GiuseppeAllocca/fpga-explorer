import raw from './fpga.json';
import type {FpgaData} from './types';

// Check the JSON shape while retaining required fields on known nodes.
const dati: FpgaData & typeof raw = raw;
export default dati;
export type Data = typeof dati;
