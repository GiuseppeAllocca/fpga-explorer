import type {Data} from '../data';
import type {SimulationSnapshot} from '../simulations/types';
import {$} from '../ui/dom';

export function announceSimulation(dati: Data, stato: SimulationSnapshot) {
  if (stato.id === 'sim_lut') $('announcement').textContent = `indirizzo ${stato.address} · O6 ${stato.o6}${stato.split ? ' · O5 ' + stato.o5 : ''}`;
  else if (stato.id === 'sim_distram' || stato.id === 'sim_srl') $('announcement').textContent = `indirizzo ${stato.address} · Q ${stato.output}`;
  else if (stato.id === 'sim_tristate') $('announcement').textContent = `Y ${stato.y} · Pin ${stato.wire}`;
  else if (stato.id === 'sim_bram') $('announcement').textContent = stato.collision === null ? `Porta A ${stato.outputs[0]} · Porta B ${stato.outputs[1]}` : 'collisione: valore non determinato';
  else if (stato.id === 'sim_switch') $('announcement').textContent = `switch matrix attraversate · ${new Set(stato.routes.flat()).size}`;
  else if (stato.id === 'sim_flow') $('announcement').textContent = dati.nodi.flusso.passi[stato.step].nome;
  else if (stato.id === 'sim_jtag') $('announcement').textContent = `TDO ${stato.tdo} · DONE ${Number(stato.done)}`;
}
