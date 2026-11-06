import type {Data} from '../data';
import type {creaSimulazioni} from '../simulations/panel';
import {$, crea, pulsante} from '../ui/dom';
import type {Model, Renderer} from './types';

export function createModel({dati, getRenderer, getPanel, simulazioni, stretto, VISTA_3D, selezioneBoard, aggiornaSimulazioni}: {
  dati: Data;
  getRenderer: () => Renderer;
  getPanel: () => {render(id: string): void};
  simulazioni: ReturnType<typeof creaSimulazioni>;
  stretto: MediaQueryList;
  VISTA_3D: boolean;
  selezioneBoard: (id: string) => void;
  aggiornaSimulazioni: () => void;
}) {
const modello: Model = {
  inAttesa: null,
  dati,
  stato: {radice:'board', selezione:'board', precedente:'board', pannelloAperto:true, foglio:45, scheda:'Spiegazione', variante:'SLICEL', modo:'lut'},
  radiceDi(id) {
    const n = dati.nodi[id];
    return n?.livello === 'laterale' ? id : dati.livelli.find(l => l.id === n?.livello)?.radice!;
  },
  render(id, opzioni = {}) {
    if (getRenderer().inTransizione) {this.inAttesa={id,opzioni};return;}
    const focusPrima=document.activeElement;
    if (!dati.nodi[id]) id = 'board';
    const s = this.stato, prima = s.radice, vecchiaSelezione = s.selezione, nuova = this.radiceDi(id);
    const modoPrima = s.modo;
    if (nuova === 'lut' && ['lut','lut.rom','lut.distram','lut.srl'].includes(id)) s.modo = id;
    if (nuova !== prima && dati.nodi[nuova!].livello === 'laterale' && dati.nodi[prima].livello !== 'laterale') s.precedente = s.selezione;
    if (opzioni.precedente && dati.nodi[opzioni.precedente]) s.precedente = opzioni.precedente;
    s.radice = nuova!; s.selezione = id; s.scheda = 'Spiegazione';
    if (stretto.matches) s.pannelloAperto = true;
    const disegna = () => {
      if (nuova !== prima || !getRenderer().gruppo || s.modo !== modoPrima) getRenderer().render(nuova!);
      getRenderer().seleziona(id);
      getPanel().render(id);
      this.barra();
      this.aperturaPannello();
      selezioneBoard(id);
      $('announcement').textContent = dati.nodi[id].titolo;
      if(focusPrima&&!focusPrima.isConnected)(VISTA_3D?$('three-nodes').querySelector('button'):$('drawing').querySelector<SVGElement>('[role="button"][tabindex="0"]'))?.focus({preventScroll:true});
    };
    if (opzioni.animazione && nuova !== prima) getRenderer().transizione(vecchiaSelezione, opzioni.inversa, disegna);
    else disegna();
    if (!opzioni.daIndirizzo) history.pushState({nodo:id,precedente:s.precedente}, '', '#' + encodeURIComponent(id));
  },
  seleziona(id) { this.render(id); },
  selezionaPin(pin) {const select=$('board-pin-select');if(select){select.value=pin;select.dispatchEvent(new Event('change'));}},
  selezionaSwitch(i) {if(simulazioni.istantanea().id!=='sim_switch'){this.render('interconnessione');$('tab-Prova')?.click();}simulazioni.switch(i);},
  selezionaPasso(i) {if(simulazioni.istantanea().id!=='sim_flow'){this.render('flusso');$('tab-Prova')?.click();}simulazioni.passo(i);},
  entra(this: Model, id = this.stato.selezione) {
    const destinazione = dati.nodi[id]?.entra_in;
    if (destinazione && !getRenderer().inTransizione) this.render(destinazione, {animazione:true});
  },
  esci() {
    const s = this.stato, n = dati.nodi[s.radice];
    if (n.livello === 'laterale') this.render(s.precedente, {animazione:true,inversa:true});
    else if (s.radice !== 'board') this.render(dati.nodi[s.radice].padre!, {animazione:true,inversa:true});
    else if (s.selezione !== 'board') this.render('board');
  },
  barra() {
    const s = this.stato, laterale = dati.nodi[s.radice].livello === 'laterale';
    const base = laterale ? this.radiceDi(s.precedente) : s.radice;
    const indice = Math.max(0, dati.livelli.findIndex(l => l.radice === base));
    $('breadcrumb').replaceChildren();
    dati.livelli.slice(0, indice + 1).forEach((l, i) => {
      if (i) crea('span', '›', null, $('breadcrumb')).setAttribute('aria-hidden', 'true');
      const b = pulsante(l.nome, () => this.render(l.radice,{animazione:true,inversa:true}), $('breadcrumb'));
      if (!laterale && l.radice === s.radice) b.setAttribute('aria-current','page');
    });
    if (laterale) {
      crea('span','›',null,$('breadcrumb')).setAttribute('aria-hidden','true');
      const b = pulsante(dati.nodi[s.radice].titolo, () => this.seleziona(s.radice), $('breadcrumb'));
      b.setAttribute('aria-current','page');
    }
    $('back-button').hidden = !laterale;
    if (laterale) $('back-button').textContent = '← Torna a ' + (dati.livelli.find(l => l.radice === base)?.nome || dati.livelli[0].nome);
    $('board-notice').hidden = s.radice !== 'board';
    $('variant').hidden = s.radice !== 'slice';
    $('variant').replaceChildren();
    if (s.radice === 'slice') dati.nodi.slice.varianti.forEach(v => {
      const b = pulsante(v, () => {if(getRenderer().inTransizione)return;s.variante=v; getRenderer().render('slice'); getRenderer().seleziona(s.selezione); this.barra();aggiornaSimulazioni();}, $('variant'));
      b.setAttribute('aria-pressed', String(v === s.variante));
    });
  },
  aperturaPannello() {
    const aperto = this.stato.pannelloAperto;
    $('panel').classList.toggle('closed', !aperto);
    $('panel-toggle').setAttribute('aria-expanded', String(aperto));
    $('panel-toggle').textContent = stretto.matches ? (aperto ? '⌄' : '⌃') : (aperto ? '›' : '‹');
    $('workspace').style.setProperty('--sheet', aperto && stretto.matches ? this.stato.foglio + '%' : '0%');
    $('sheet-handle').setAttribute('aria-valuetext', this.stato.foglio + '%');$('sheet-handle').setAttribute('aria-valuenow', String(this.stato.foglio));
  }
};
return modello;
}
