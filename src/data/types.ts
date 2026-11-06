export interface SourceReference {
  id: string;
  pagina?: number | string;
}

export interface Source {
  etichetta: string;
  tipo: string;
  url?: string;
}

export interface Level {
  id: string;
  nome: string;
  radice: string;
}

export interface NumericFact {
  voce: string;
  valore: string;
  fonte: string;
  pagina?: number | string;
}

export interface FlowStep {
  nome: string;
  testo: string;
  fonte: string;
  pagina?: number | string;
}

export interface FpgaNode {
  livello: string;
  padre: string | null;
  titolo: string;
  termine_en?: string;
  in_breve?: string;
  spiegazione?: string[];
  numeri?: NumericFact[];
  fonti: SourceReference[];
  figli?: string[];
  entra_in?: string;
  collegati?: string[];
  interazione?: string;
  pin?: Record<string, string>;
  errore_comune?: string;
  vai_a?: string;
  varianti?: string[];
  esempio?: string;
  passi?: FlowStep[];
}

export interface FpgaData {
  meta: {
    titolo: string;
    versione_dati: string;
    data: string;
    autore_dati: string;
    dispositivo: string;
    avviso_board: string;
    avviso_schema: string;
  };
  fonti: Record<string, Source>;
  livelli: Level[];
  nodi: Record<string, FpgaNode>;
}
