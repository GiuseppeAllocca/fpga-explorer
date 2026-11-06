import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import dati from '../src/data/fpga.json';

const nodi = Object.entries(dati.nodi);

describe('integrità dei dati', () => {
  it('conserva esattamente i contenuti pubblici della base approvata', () => {
    const raw = readFileSync(new URL('../src/data/fpga.json', import.meta.url));
    expect(createHash('sha256').update(raw).digest('hex')).toBe('f93cc650c80e6a5db6d727b2331893ee95b7175b9630b972b32184a96618e2e6');
  });
  it('ogni nodo ha un padre, dei figli e una destinazione validi', () => {
    for (const [id, n] of nodi) {
      if (n.padre) expect(dati.nodi[n.padre], `${id}.padre`).toBeDefined();
      for (const f of n.figli ?? []) expect(dati.nodi[f], `${id}.figli ${f}`).toBeDefined();
      if (n.entra_in) expect(dati.nodi[n.entra_in], `${id}.entra_in`).toBeDefined();
      for (const c of n.collegati ?? []) expect(dati.nodi[c], `${id}.collegati ${c}`).toBeDefined();
    }
  });

  it('ogni nodo cita almeno una fonte esistente', () => {
    for (const [id, n] of nodi) {
      expect(n.fonti?.length, `${id} senza fonti`).toBeGreaterThan(0);
      const righe = [...n.fonti, ...(n.numeri ?? []).map(r => ({ id: r.fonte })), ...(n.passi ?? []).map(r => ({ id: r.fonte }))];
      for (const r of righe) expect(dati.fonti[r.id], `${id}: fonte ${r.id}`).toBeDefined();
    }
  });

  it('le fonti web sono https e non ci sono fonti locali', () => {
    for (const [id, f] of Object.entries(dati.fonti)) {
      expect(['web', 'claude', 'da_verificare']).toContain(f.tipo);
      if (f.tipo === 'web') expect(f.url, id).toMatch(/^https:\/\//);
    }
  });

  it('i livelli puntano a nodi esistenti', () => {
    for (const l of dati.livelli) expect(dati.nodi[l.radice], l.id).toBeDefined();
  });
});

// Guardia sulla riservatezza: nessun dato personale o percorso locale nel repository.
describe('nessun dato personale', () => {
  const vietati = /\/Users\/|obsidian|vault|università|gmail|mazzocca|de benedictis|trascrizione|wiki\/|giuseppe(?!allocca)|nota_giuseppe/i;
  const radice = new URL('..', import.meta.url).pathname;
  const salta = new Set(['node_modules', 'dist', '.git', 'package-lock.json', 'privacy.test.js', 'data.test.js']);
  const file = dir => readdirSync(dir).flatMap(nome => {
    if (salta.has(nome)) return [];
    const p = join(dir, nome);
    return statSync(p).isDirectory() ? file(p) : [p];
  });

  it('nessun file contiene termini vietati', () => {
    for (const p of file(radice)) {
      if (!/\.(js|ts|json|html|css|md|yml|yaml|txt)$|LICENSE/.test(p)) continue;
      expect(readFileSync(p, 'utf8'), p).not.toMatch(vietati);
    }
  });
});
