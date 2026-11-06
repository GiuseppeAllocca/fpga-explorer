import type {Renderer} from './model/types';
import type {SimulationSnapshot} from './simulations/types';
import {createAddress} from './model/address';
import {setupControls} from './ui/controls';
import {announceSimulation} from './panel/announcement';
import {createRenderer2d} from './render2d';
import {createPanel} from './panel';
import {createBoard} from './panel/board';
import dati from './data';
import {createModel} from './model/state';
import {$, crea, pulsante} from './ui/dom';
import './styles/app.css';
import './styles/simulations.css';
import './styles/chip-simulations.css';
import {creaSimulazioni} from './simulations/panel.ts';

// Three.js si carica solo nella pagina 3D.
const creaRenderer3d = document.documentElement.dataset.view === '3d' ? (await import('./three/renderer3d.ts')).creaRenderer3d : null;

const VISTA_3D = document.documentElement.dataset.view === '3d';
const riduciMovimento = matchMedia('(prefers-reduced-motion: reduce)');
const stretto = matchMedia('(max-width: 1099px)');
const preciso = matchMedia('(hover: hover) and (pointer: fine)');
const simulazioni = creaSimulazioni({dati, cambiato: aggiornaSimulazioni, riduciMovimento: () => riduciMovimento.matches});
// Modello: dati, indirizzo, navigazione e stato; nessuna geometria del disegno.
const board = createBoard({dati, riduciMovimento, aggiornaSimulazioni});
const boardState = board.state;
const selezioneBoard = board.selezioneBoard;
const modello = createModel({dati, getRenderer: () => rendererAttivo, getPanel: () => pannello, simulazioni, stretto, VISTA_3D, selezioneBoard, aggiornaSimulazioni});

// Pannello: contenuti letterali dei dati e soli testi dell'interfaccia ammessi.
const pannello = createPanel({dati, modello, simulazioni, dettaglioPin: board.dettaglioPin});

function aggiornaSimulazioni(stato: SimulationSnapshot = simulazioni.istantanea()) {
  rendererAttivo.aggiornaSimulazione?.({...stato, board: boardState});
  announceSimulation(dati, stato);
}


const renderer2d = createRenderer2d({dati, modello, simulazioni, boardState, riduciMovimento, preciso});

// Renderer attivo: SVG nella pagina 2D, Three.js nella pagina 3D; modello e pannello sono condivisi.
let rendererAttivo: Renderer;
if (VISTA_3D) {
  try {
    rendererAttivo = creaRenderer3d!({dati, modello, mount:$('three-view'), navigazione:$('three-nodes')});
  } catch (errore) {
    console.error(errore);
    $('three-view').dataset.error = (errore as Error).message;
    const ripiego = crea('div', null, 'three-fallback', $('three-view'));
    pulsante('2D', () => address.cambiaVista('index.html'), ripiego);
    rendererAttivo = {gruppo:null, inTransizione:false, vista:{scala:1,x:0,y:0}, render(){}, seleziona(){}, ridimensiona(){}, zoom(){}, applicaVista(){}, richiediVista(){}, input(){}, transizione(id, inversa, azione){azione();}};
  }
} else rendererAttivo = renderer2d;

const address = createAddress(modello);
setupControls({dati, modello, rendererAttivo, simulazioni, board, riduciMovimento, stretto, VISTA_3D, aggiornaSimulazioni, ...address});
address.connect();
