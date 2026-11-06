import type {Data} from '../data';
import {$, crea, svg} from '../ui/dom';

export function createBoard({dati, riduciMovimento, aggiornaSimulazioni}: {dati: Data; riduciMovimento: MediaQueryList; aggiornaSimulazioni: () => void}) {
const boardState: {pin: string | null; digit: number | null} = {pin: null, digit: null};
let boardTimer: ReturnType<typeof setInterval> | null = null;
function selezioneBoard(id: string) {
  if (boardTimer !== null) clearInterval(boardTimer);
  boardTimer = null;boardState.digit = null;
  if (!['board.switch', 'board.led'].includes(id)) boardState.pin = null;
  if (id === 'board.display') {
    boardState.digit = 7;
    if (!riduciMovimento.matches && !document.hidden) boardTimer = setInterval(() => {boardState.digit = (boardState.digit! + 7) % 8;aggiornaSimulazioni();}, 200);
  }
  aggiornaSimulazioni();
}

function dettaglioPin(id: string, parent: Element) {
  const entries = Object.entries(dati.nodi[id].pin!);
  if (!entries.some(([, pin]) => pin === boardState.pin)) boardState.pin = entries[0][1];
  const section = crea('section', null, 'sim-field', parent);crea('h3', 'Pin', null, section);
  const select = crea('select', null, null, section);select.id = 'board-pin-select';select.setAttribute('aria-label', 'Pin');
  entries.forEach(([name, pin]) => {const o = crea('option', name + ' · ' + pin, null, select);o.value = pin;});
  select.value = boardState.pin!;
  const miniature = svg('svg', {viewBox: '0 0 320 400', class: 'pin-miniature', role: 'img', 'aria-label': 'Pin'}, section);
  svg('rect', {x: 80, y: 36, width: 160, height: 328, rx: 8, class: 'package'}, miniature);
  entries.forEach(([name, pin], i) => {
    const right = i >= 8, y = 60 + (i % 8) * 40;
    svg('circle', {cx: right ? 240 : 80, cy: y, r: 5, fill: 'var(--testo-2)', 'data-pin-marker': pin}, miniature);
    const text = svg('text', {x: right ? 252 : 68, y: y + 5, 'text-anchor': right ? 'start' : 'end', 'data-pin-marker': pin}, miniature);text.textContent = pin;
  });
  const update = () => {
    boardState.pin = select.value;
    miniature.setAttribute('aria-label', select.selectedOptions[0].textContent!);
    miniature.querySelectorAll('[data-pin-marker]').forEach(e => {const active = e.getAttribute('data-pin-marker') === boardState.pin!;e.classList.toggle('selected', active);if (e.tagName.toLowerCase() === 'circle') e.setAttribute('fill', active ? 'var(--accento)' : 'var(--testo-2)');});
    aggiornaSimulazioni();
  };
  select.addEventListener('change', update);update();
}

return {state: boardState, selezioneBoard, dettaglioPin, ferma() {if (boardTimer !== null) clearInterval(boardTimer); boardTimer = null;}};
}
