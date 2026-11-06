export function $(id: 'drawing'): SVGSVGElement;
export function $(id: 'board-pin-select'): HTMLSelectElement;
export function $(id: string): HTMLElement;
export function $(id: string): HTMLElement | SVGSVGElement {
  // Both entry pages declare the required elements; optional controls keep their runtime null value.
  return document.getElementById(id)!;
}

export function crea<K extends keyof HTMLElementTagNameMap>(tag: K, testo?: string | number | null, classe?: string | null, padre?: Element) {
  const e = document.createElement(tag);
  if (testo !== undefined && testo !== null) e.textContent = String(testo);
  if (classe) e.className = classe;
  if (padre) padre.append(e);
  return e;
}

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributi: Record<string, string | number> = {}, padre?: Element) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attributi)) e.setAttribute(k, String(v));
  if (padre) padre.append(e);
  return e;
}

export function pulsante(testo: string, azione: () => void, padre: Element, classe?: string) {
  const e = crea('button', testo, classe, padre);
  e.type = 'button';
  e.addEventListener('click', azione);
  return e;
}
