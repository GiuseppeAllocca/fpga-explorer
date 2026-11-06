import type {Model} from './types';

export function createAddress(modello: Model) {
const dati=modello.dati;
const parametriVista=new URLSearchParams(location.search);
const varianteVista=parametriVista.get('variante');
if(dati.nodi.slice.varianti.includes(varianteVista || ''))modello.stato.variante=varianteVista!;
const modoVista=parametriVista.get('modo');
if(['lut','lut.rom','lut.distram','lut.srl'].includes(modoVista || ''))modello.stato.modo=modoVista!;
const ritornoVista=parametriVista.get('ritorno');
if(ritornoVista && dati.nodi[ritornoVista])modello.stato.precedente=ritornoVista;
function cambiaVista(file: string){
  const p=new URLSearchParams({variante:modello.stato.variante,modo:modello.stato.modo,ritorno:modello.stato.precedente,tema:document.documentElement.dataset.theme!});
  location.href=file+'?'+p.toString()+'#'+encodeURIComponent(modello.stato.selezione);
}
function daIndirizzo(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{id='board';}modello.render(id||'board',{daIndirizzo:true,precedente:history.state?.precedente || ritornoVista});}
return {parametriVista, cambiaVista, connect() {
addEventListener('popstate',daIndirizzo);addEventListener('hashchange',()=>{let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{id='board';}if(id!==modello.stato.selezione)daIndirizzo();});
daIndirizzo();
if(!location.hash||!dati.nodi[location.hash.slice(1)])history.replaceState({nodo:modello.stato.selezione,precedente:modello.stato.precedente},'','#'+modello.stato.selezione);

}};
}
