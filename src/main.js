import {createRenderer2d} from './render2d';
import {createPanel} from './panel';
import {createBoard} from './panel/board';
import dati from './data';
import {createModel} from './model/state';
import {$, crea, svg, pulsante} from './ui/dom';
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

function aggiornaSimulazioni(stato = simulazioni.istantanea()) {
  rendererAttivo.aggiornaSimulazione?.({...stato, board: boardState});
  if (stato.id === 'sim_lut') $('announcement').textContent = `indirizzo ${stato.address} · O6 ${stato.o6}${stato.split ? ' · O5 ' + stato.o5 : ''}`;
  else if (stato.id === 'sim_distram' || stato.id === 'sim_srl') $('announcement').textContent = `indirizzo ${stato.address} · Q ${stato.output}`;
  else if (stato.id === 'sim_tristate') $('announcement').textContent = `Y ${stato.y} · Pin ${stato.wire}`;
  else if (stato.id === 'sim_bram') $('announcement').textContent = stato.collision === null ? `Porta A ${stato.outputs[0]} · Porta B ${stato.outputs[1]}` : 'collisione: valore non determinato';
  else if (stato.id === 'sim_switch') $('announcement').textContent = `switch matrix attraversate · ${new Set(stato.routes.flat()).size}`;
  else if (stato.id === 'sim_flow') $('announcement').textContent = dati.nodi.flusso.passi[stato.step].nome;
  else if (stato.id === 'sim_jtag') $('announcement').textContent = `TDO ${stato.tdo} · DONE ${Number(stato.done)}`;
}


const renderer2d = createRenderer2d({dati, modello, simulazioni, boardState, riduciMovimento, preciso});

// Renderer attivo: SVG nella pagina 2D, Three.js nella pagina 3D; modello e pannello sono condivisi.
let rendererAttivo;
if (VISTA_3D) {
  try {
    rendererAttivo = creaRenderer3d({dati, modello, mount:$('three-view'), navigazione:$('three-nodes')});
  } catch (errore) {
    console.error(errore);
    $('three-view').dataset.error = errore.message;
    const ripiego = crea('div', null, 'three-fallback', $('three-view'));
    pulsante('2D', () => cambiaVista('index.html'), ripiego);
    rendererAttivo = {gruppo:null, inTransizione:false, vista:{x:0,y:0}, render(){}, seleziona(){}, ridimensiona(){}, zoom(){}, applicaVista(){}, richiediVista(){}, input(){}, transizione(id, inversa, azione){azione();}};
  }
} else rendererAttivo = renderer2d;

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
function apriLegenda(apri){$('legend').hidden=!apri;$('legend-button').setAttribute('aria-expanded',String(apri));if(apri)$('legend').querySelector('button').focus();else $('legend-button').focus();}
function applicaTema(tema,salva=false){
  document.documentElement.dataset.theme=tema;
  const prossimo=tema==='dark'?'Tema chiaro':'Tema scuro';
  $('theme-button').textContent=tema==='dark'?'☀':'☾';$('theme-button').setAttribute('aria-label',prossimo);$('theme-button').title=prossimo;
  if(salva)try{localStorage.setItem('esploratore-fpga-tema',tema);}catch{}
  if(rendererAttivo.gruppo&&!rendererAttivo.inTransizione){rendererAttivo.render(modello.stato.radice);rendererAttivo.seleziona(modello.stato.selezione);}
  aggiornaSimulazioni();
}
function daIndirizzo(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{id='board';}modello.render(id||'board',{daIndirizzo:true,precedente:history.state?.precedente || ritornoVista});}
function impostaFoglio(percentuale){modello.stato.foglio=percentuale;modello.stato.pannelloAperto=true;modello.aperturaPannello();}
$('brand').textContent=dati.meta.titolo;$('brand').title=dati.meta.titolo;document.title=dati.meta.titolo;
$('schema-notice').textContent=dati.meta.avviso_schema;$('schema-notice').title=dati.meta.avviso_schema;
$('board-notice').textContent=dati.meta.avviso_board;
$('flow-button').addEventListener('click',()=>modello.render('flusso'));
$('back-button').addEventListener('click',()=>modello.esci());
$('panel-toggle').addEventListener('click',()=>{modello.stato.pannelloAperto=!modello.stato.pannelloAperto;modello.aperturaPannello();});
$('zoom-in').addEventListener('click',()=>rendererAttivo.zoom(1.25));$('zoom-out').addEventListener('click',()=>rendererAttivo.zoom(.8));
$('fit-button').addEventListener('click',()=>{rendererAttivo.vista={scala:1,x:0,y:0};rendererAttivo.applicaVista();});
$('legend-button').addEventListener('click',()=>apriLegenda($('legend').hidden));
$('theme-button').addEventListener('click',()=>applicaTema(document.documentElement.dataset.theme==='dark'?'light':'dark',true));

// Il passaggio fra i due file conserva il nodo e il contesto di esplorazione.
const parametriVista=new URLSearchParams(location.search);
const varianteVista=parametriVista.get('variante');
if(dati.nodi.slice.varianti.includes(varianteVista))modello.stato.variante=varianteVista;
const modoVista=parametriVista.get('modo');
if(['lut','lut.rom','lut.distram','lut.srl'].includes(modoVista))modello.stato.modo=modoVista;
const ritornoVista=parametriVista.get('ritorno');
if(dati.nodi[ritornoVista])modello.stato.precedente=ritornoVista;
function cambiaVista(file){
  const p=new URLSearchParams({variante:modello.stato.variante,modo:modello.stato.modo,ritorno:modello.stato.precedente,tema:document.documentElement.dataset.theme});
  location.href=file+'?'+p.toString()+'#'+encodeURIComponent(modello.stato.selezione);
}
$('view-3d')?.addEventListener('click',()=>cambiaVista('3d.html'));
$('view-2d')?.addEventListener('click',()=>cambiaVista('index.html'));

let tema=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
try{const salvato=localStorage.getItem('esploratore-fpga-tema');if(['dark','light'].includes(salvato))tema=salvato;}catch{}
if(['light','dark'].includes(parametriVista.get('tema')))tema=parametriVista.get('tema');
applicaTema(tema);legenda();rendererAttivo.input();
const maniglia=$('sheet-handle');let trascinaFoglio=null;
maniglia.addEventListener('pointerdown',e=>{if(e.button>0)return;trascinaFoglio={y:e.clientY,valore:modello.stato.foglio,mosso:false};maniglia.setPointerCapture(e.pointerId);});
maniglia.addEventListener('pointermove',e=>{if(!trascinaFoglio)return;const delta=(trascinaFoglio.y-e.clientY)/$('workspace').clientHeight*100;if(Math.abs(delta)>1)trascinaFoglio.mosso=true;const altezza=Math.max(20,Math.min(85,trascinaFoglio.valore+delta));$('workspace').style.setProperty('--sheet',altezza+'%');});
const terminaFoglio=e=>{if(!trascinaFoglio)return;const t=trascinaFoglio;trascinaFoglio=null;if(maniglia.hasPointerCapture(e.pointerId))maniglia.releasePointerCapture(e.pointerId);const valore=t.valore+(t.y-e.clientY)/$('workspace').clientHeight*100;impostaFoglio(t.mosso?[20,45,85].reduce((a,b)=>Math.abs(a-valore)<Math.abs(b-valore)?a:b):[20,45,85][([20,45,85].indexOf(modello.stato.foglio)+1)%3]);};
maniglia.addEventListener('pointerup',terminaFoglio);maniglia.addEventListener('pointercancel',()=>{trascinaFoglio=null;modello.aperturaPannello();});
maniglia.addEventListener('click',e=>{if(e.detail===0)impostaFoglio([20,45,85][([20,45,85].indexOf(modello.stato.foglio)+1)%3]);});
maniglia.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();impostaFoglio([20,45,85][([20,45,85].indexOf(modello.stato.foglio)+1)%3]);return;}if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const i=[20,45,85].indexOf(modello.stato.foglio);impostaFoglio(e.key==='Home'?20:e.key==='End'?85:[20,45,85][Math.max(0,Math.min(2,i+(e.key==='ArrowUp'?1:-1)))]);}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();if(!$('legend').hidden)apriLegenda(false);else modello.esci();return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&$('stage').contains(e.target)){e.preventDefault();rendererAttivo.vista.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;rendererAttivo.vista.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;rendererAttivo.richiediVista();}
});
document.addEventListener('pointerdown',e=>{if(!$('legend').hidden&&!$('legend').contains(e.target)&&!$('legend-button').contains(e.target))apriLegenda(false);});
addEventListener('popstate',daIndirizzo);addEventListener('hashchange',()=>{let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{id='board';}if(id!==modello.stato.selezione)daIndirizzo();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){board.ferma();simulazioni.ferma();}else if(modello.stato.selezione==='board.display')selezioneBoard('board.display');});
riduciMovimento.addEventListener('change',()=>{simulazioni.ferma();selezioneBoard(modello.stato.selezione);});
stretto.addEventListener('change',()=>modello.aperturaPannello());
new ResizeObserver(()=>rendererAttivo.ridimensiona()).observe(VISTA_3D?$('three-view'):$('drawing'));
daIndirizzo();
if(!location.hash||!dati.nodi[location.hash.slice(1)])history.replaceState({nodo:modello.stato.selezione,precedente:modello.stato.precedente},'','#'+modello.stato.selezione);
