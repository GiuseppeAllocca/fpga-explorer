import type {Data} from '../data';
import type {Model, Renderer} from '../model/types';
import type {creaSimulazioni} from '../simulations/panel';
import type {createBoard} from '../panel/board';
import {$, crea, svg, pulsante} from './dom';

export function setupControls({dati, modello, rendererAttivo, simulazioni, board, riduciMovimento, stretto, VISTA_3D, aggiornaSimulazioni, parametriVista, cambiaVista}: {
  dati: Data;
  modello: Model;
  rendererAttivo: Renderer;
  simulazioni: ReturnType<typeof creaSimulazioni>;
  board: ReturnType<typeof createBoard>;
  riduciMovimento: MediaQueryList;
  stretto: MediaQueryList;
  VISTA_3D: boolean;
  aggiornaSimulazioni: () => void;
  parametriVista: URLSearchParams;
  cambiaVista: (file: string) => void;
}) {
const selezioneBoard=board.selezioneBoard;
function legenda() {
  const l=$('legend');l.replaceChildren();
  const testa=crea('div',null,'legend-head',l);crea('h2','Legenda',null,testa);
  pulsante('×',()=>apriLegenda(false),testa).setAttribute('aria-label','Legenda');
  const griglia=crea('div',null,'legend-grid',l);
  [['slicel','SLICEL'],['slicem','SLICEM'],['dsp','DSP'],['memoria','RAM distribuita'],['cmt','CMT'],['io','I/O'],['clock','HROW'],['gt','GTP']].forEach(([token,nome])=>{const r=crea('div',null,'legend-item',griglia);const c=crea('span',null,'swatch',r);c.style.background=`var(--${token})`;crea('span',nome,null,r);});
  const simboli=crea('div',null,'legend-grid legend-symbols',l);
  const esempi=[['BUFG','M4 4 L4 28 L30 16 Z'],['MUX','M5 3 L29 9 V23 L5 29 Z'],['FF','M4 3 H33 V29 H4 Z M4 12 L12 16 L4 20'],['Latch','M4 3 H33 V29 H4 Z'],['CLK','M2 25 V7 H12 V25 H22 V7 H34'],['Z','M3 16 H34']];
  esempi.forEach(([nome,d])=>{const r=crea('div',null,'legend-item',simboli);const ic=svg('svg',{viewBox:'0 0 40 32',class:'symbol','aria-hidden':'true'},r);const p=svg('path',{d},ic);if(nome==='Z')p.setAttribute('stroke-dasharray','4 3');if(nome==='Latch'){const t=svg('text',{x:13,y:20},ic);t.textContent='D';}crea('span',nome,null,r);});
}
function apriLegenda(apri: boolean){$('legend').hidden=!apri;$('legend-button').setAttribute('aria-expanded',String(apri));if(apri)$('legend').querySelector('button')!.focus();else $('legend-button').focus();}
function applicaTema(tema: string,salva=false){
  document.documentElement.dataset.theme=tema;
  const prossimo=tema==='dark'?'Tema chiaro':'Tema scuro';
  $('theme-button').textContent=tema==='dark'?'☀':'☾';$('theme-button').setAttribute('aria-label',prossimo);$('theme-button').title=prossimo;
  if(salva)try{localStorage.setItem('esploratore-fpga-tema',tema);}catch{}
  if(rendererAttivo.gruppo&&!rendererAttivo.inTransizione){rendererAttivo.render(modello.stato.radice);rendererAttivo.seleziona(modello.stato.selezione);}
  aggiornaSimulazioni();
}
function impostaFoglio(percentuale: number){modello.stato.foglio=percentuale;modello.stato.pannelloAperto=true;modello.aperturaPannello();}
$('brand').textContent=dati.meta.titolo;$('brand').title=dati.meta.titolo;document.title=dati.meta.titolo;
$('schema-notice').textContent=dati.meta.avviso_schema;$('schema-notice').title=dati.meta.avviso_schema;
$('board-notice').textContent=dati.meta.avviso_board;
$('flow-button').addEventListener('click',()=>modello.render('flusso'));
$('back-button').addEventListener('click',()=>modello.esci());
$('panel-toggle').addEventListener('click',()=>{modello.stato.pannelloAperto=!modello.stato.pannelloAperto;modello.aperturaPannello();});
$('zoom-in').addEventListener('click',()=>rendererAttivo.zoom(1.25));$('zoom-out').addEventListener('click',()=>rendererAttivo.zoom(.8));
$('fit-button').addEventListener('click',()=>{rendererAttivo.vista={scala:1,x:0,y:0};rendererAttivo.applicaVista();});
$('legend-button').addEventListener('click',()=>apriLegenda(Boolean($('legend').hidden)));
$('theme-button').addEventListener('click',()=>applicaTema(document.documentElement.dataset.theme==='dark'?'light':'dark',true));

// Il passaggio fra i due file conserva il nodo e il contesto di esplorazione.

$('view-3d')?.addEventListener('click',()=>cambiaVista('3d.html'));
$('view-2d')?.addEventListener('click',()=>cambiaVista('index.html'));

let tema=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
try{const salvato=localStorage.getItem('esploratore-fpga-tema');if(['dark','light'].includes(salvato || ''))tema=salvato!;}catch{}
if(['light','dark'].includes(parametriVista.get('tema') || ''))tema=parametriVista.get('tema')!;
applicaTema(tema);legenda();rendererAttivo.input();
const maniglia=$('sheet-handle');let trascinaFoglio: {y: number; valore: number; mosso: boolean} | null=null;
maniglia.addEventListener('pointerdown',e=>{if(e.button>0)return;trascinaFoglio={y:e.clientY,valore:modello.stato.foglio,mosso:false};maniglia.setPointerCapture(e.pointerId);});
maniglia.addEventListener('pointermove',e=>{if(!trascinaFoglio)return;const delta=(trascinaFoglio.y-e.clientY)/$('workspace').clientHeight*100;if(Math.abs(delta)>1)trascinaFoglio.mosso=true;const altezza=Math.max(20,Math.min(85,trascinaFoglio.valore+delta));$('workspace').style.setProperty('--sheet',altezza+'%');});
const terminaFoglio=(e: PointerEvent)=>{if(!trascinaFoglio)return;const t=trascinaFoglio;trascinaFoglio=null;if(maniglia.hasPointerCapture(e.pointerId))maniglia.releasePointerCapture(e.pointerId);const valore=t.valore+(t.y-e.clientY)/$('workspace').clientHeight*100;impostaFoglio(t.mosso?[20,45,85].reduce((a,b)=>Math.abs(a-valore)<Math.abs(b-valore)?a:b):[20,45,85][([20,45,85].indexOf(modello.stato.foglio)+1)%3]);};
maniglia.addEventListener('pointerup',terminaFoglio);maniglia.addEventListener('pointercancel',()=>{trascinaFoglio=null;modello.aperturaPannello();});
maniglia.addEventListener('click',e=>{if(e.detail===0)impostaFoglio([20,45,85][([20,45,85].indexOf(modello.stato.foglio)+1)%3]);});
maniglia.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();impostaFoglio([20,45,85][([20,45,85].indexOf(modello.stato.foglio)+1)%3]);return;}if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const i=[20,45,85].indexOf(modello.stato.foglio);impostaFoglio(e.key==='Home'?20:e.key==='End'?85:[20,45,85][Math.max(0,Math.min(2,i+(e.key==='ArrowUp'?1:-1)))]);}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();if(!$('legend').hidden)apriLegenda(false);else modello.esci();return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&$('stage').contains(e.target as Node)){e.preventDefault();rendererAttivo.vista.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;rendererAttivo.vista.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;rendererAttivo.richiediVista();}
});
document.addEventListener('pointerdown',e=>{if(!$('legend').hidden&&!$('legend').contains(e.target as Node)&&!$('legend-button').contains(e.target as Node))apriLegenda(false);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){board.ferma();simulazioni.ferma();}else if(modello.stato.selezione==='board.display')selezioneBoard('board.display');});
riduciMovimento.addEventListener('change',()=>{simulazioni.ferma();selezioneBoard(modello.stato.selezione);});
stretto.addEventListener('change',()=>modello.aperturaPannello());
new ResizeObserver(()=>rendererAttivo.ridimensiona()).observe(VISTA_3D?$('three-view'):$('drawing'));

}
