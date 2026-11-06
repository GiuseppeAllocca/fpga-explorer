import type {Data} from '../data';
import type {FpgaNode, SourceReference} from '../data/types';
import type {Model} from '../model/types';
import type {creaSimulazioni} from '../simulations/panel';
import {$, crea, pulsante} from '../ui/dom';

export function createPanel({dati, modello, simulazioni, dettaglioPin}: {dati: Data; modello: Model; simulazioni: ReturnType<typeof creaSimulazioni>; dettaglioPin: (id: string, parent: Element) => void}) {
const riferimenti = (nodo: FpgaNode) => {
  const lista = [...(nodo.fonti || []), ...(nodo.numeri || []).map(r => ({id:r.fonte,pagina:r.pagina})), ...(nodo.passi || []).map(r => ({id:r.fonte,pagina:r.pagina}))];
  return lista.filter((r, i) => lista.findIndex(x => x.id === r.id && x.pagina === r.pagina) === i);
};
const tipiIncerti = (nodo: FpgaNode) => [...new Set(riferimenti(nodo).map(r => dati.fonti[r.id]?.tipo).filter((t): t is keyof typeof TESTO_BADGE => t !== undefined && t in TESTO_BADGE))];
const TESTO_BADGE = {claude:'Non dalle fonti citate', da_verificare:'Da verificare'};
const badgeClaude = (padre: Element, tipo: keyof typeof TESTO_BADGE = 'claude') => crea('span', TESTO_BADGE[tipo], 'badge ' + tipo, padre);
const linkFonte = (riferimento: SourceReference, padre: Element) => {
  const f = dati.fonti[riferimento.id];
  if (!f) return;
  if (f.tipo in TESTO_BADGE) { badgeClaude(padre, f.tipo as keyof typeof TESTO_BADGE); return; }
  const a = crea('a', f.etichetta, null, padre);
  if (/^https?:\/\//.test(f.url || '')) { a.href = f.url!; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  if (riferimento.pagina !== undefined) crea('span', ' · p. ' + riferimento.pagina, null, padre);
};

const pannello = {
  render(id: string) {
    simulazioni.chiudi();
    const n = dati.nodi[id], contenitore = $('panel-scroll');
    contenitore.replaceChildren(); contenitore.scrollTop = 0;
    crea('h2', n.titolo, null, contenitore);
    if (n.termine_en) crea('p', n.termine_en, 'term', contenitore);
    const badges = crea('div', null, 'badges', contenitore);
    const l = dati.livelli.find(l => l.id === n.livello);
    if (l) crea('span', 'Livello ' + n.livello.slice(1) + ' · ' + l.nome, 'badge', badges);
    if (id === 'lut.distram' || id === 'lut.srl') crea('span', 'solo SLICEM', 'badge', badges);
    tipiIncerti(n).forEach(t => badgeClaude(badges, t));
    if (n.in_breve) crea('p', n.in_breve, 'summary', contenitore);
    if (n.pin) dettaglioPin(id, contenitore);
    const azioni = crea('div', null, 'panel-actions', contenitore);
    if (n.entra_in) pulsante('Entra', () => modello.entra(id), azioni, 'primary');
    if (n.vai_a) pulsante('Apri la scheda', () => modello.render(n.vai_a!), azioni);
    if (!azioni.childElementCount) azioni.remove();
    const tabs = crea('div', null, 'tabs', contenitore);
    tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label','Spiegazione');
    const nomi = ['Spiegazione', ...(n.numeri || n.pin ? ['Numeri'] : []), ...(simulazioni.perNodo(id) ? ['Prova'] : []), 'Fonti'];
    const area = crea('div', null, 'tab-content', contenitore);
    area.id = 'panel-tab-content'; area.setAttribute('role','tabpanel'); area.tabIndex = 0;
    const scegliScheda = (nome: string, focus = false) => {
      simulazioni.chiudi();
      modello.stato.scheda = nome;
      ([...tabs.children] as HTMLButtonElement[]).forEach(b => {const attivo = b.textContent === nome; b.setAttribute('aria-selected',String(attivo)); b.tabIndex = attivo ? 0 : -1; if(attivo && focus) b.focus();});
      area.setAttribute('aria-labelledby','tab-' + nome);
      area.replaceChildren();
      if (nome === 'Spiegazione') this.spiegazione(n, area);
      else if (nome === 'Numeri') this.numeri(n, area);
      else if (nome === 'Prova') simulazioni.monta(simulazioni.perNodo(id)!, area);
      else this.fonti(n, area);
    };
    nomi.forEach(nome => {
      const b = pulsante(nome, () => scegliScheda(nome), tabs);
      b.id = 'tab-' + nome; b.setAttribute('role','tab'); b.setAttribute('aria-controls',area.id);
      b.addEventListener('keydown', e => {
        const i=nomi.indexOf(nome);
        if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
          e.preventDefault();
          scegliScheda(nomi[e.key==='Home'?0:e.key==='End'?nomi.length-1:(i+(e.key==='ArrowRight'?1:nomi.length-1))%nomi.length],true);
        }
      });
    });
    scegliScheda('Spiegazione');
    crea('div', 'Nodo: ' + id, 'node-footer mono', contenitore);
  },
  spiegazione(n: FpgaNode, area: HTMLElement) {
    (n.spiegazione || []).forEach(p => crea('p', p, null, area));
    ([['esempio','Esempio',''],['errore_comune','Errore comune','error']] as const).forEach(([campo, etichetta, classe]) => {
      if (!n[campo]) return;
      const c = crea('section', null, 'callout ' + classe, area);
      crea('h3', etichetta, null, c); crea('p', n[campo], null, c);
    });
    (n.passi || []).forEach(p => {
      const c=crea('section',null,'step',area);
      crea('h3',p.nome,null,c); crea('p',p.testo,null,c);
      linkFonte({id:p.fonte,pagina:p.pagina},crea('div',null,'source',c));
    });
    if (n.collegati?.length) {
      const c=crea('section',null,'links',area); crea('h3','Collegati',null,c);
      const r=crea('div',null,'related',c);
      n.collegati.forEach(id => pulsante(dati.nodi[id].titolo,()=>modello.render(id),r));
    }
  },
  numeri(n: FpgaNode, area: HTMLElement) {
    if (n.numeri?.length) {
      const t=crea('table',null,'numbers',area); t.setAttribute('aria-label','Numeri');
      const corpo=crea('tbody',null,null,t);
      n.numeri.forEach(r => {
        const tr=crea('tr',null,null,corpo); crea('th',r.voce,null,tr).scope='row';
        const td=crea('td',null,null,tr); crea('span',r.valore,null,td);
        linkFonte({id:r.fonte,pagina:r.pagina},crea('small',null,'source',td));
      });
    }
    if (n.pin) {
      const t=crea('table',null,'numbers mono',area); t.setAttribute('aria-label','Pin');
      crea('caption','Pin',null,t);
      const corpo=crea('tbody',null,null,t);
      Object.entries(n.pin).forEach(([nome,pin]) => {const tr=crea('tr',null,null,corpo); crea('th',nome,null,tr).scope='row'; crea('td',pin,null,tr);});
      const fonti=crea('div',null,'sources',area); (n.fonti || []).forEach(r=>linkFonte(r,crea('div',null,'source',fonti)));
    }
  },
  fonti(n: FpgaNode, area: HTMLElement) {
    const elenco=crea('ul',null,'sources',area);
    riferimenti(n).forEach(r=>linkFonte(r,crea('li',null,null,elenco)));
  }
};
return pannello;
}
