import {describe, expect, it} from 'vitest';
import {accessibleLabel} from '../src/render2d/index.ts';

describe('nomi accessibili del renderer 2D', () => {
  it('mantiene il titolo quando non ci sono testi visibili', () => {
    expect(accessibleLabel('La slice', '')).toBe('La slice');
  });

  it('evita di ripetere un testo già presente fuori parentesi', () => {
    expect(accessibleLabel('La slice', 'Slice')).toBe('La slice');
  });

  it('mantiene riconoscibile un nome tecnico presente solo fra parentesi', () => {
    const title = 'I multiplexer larghi (F7AMUX, F7BMUX, F8MUX)';
    expect(accessibleLabel(title, 'F7BMUX')).toBe(title + ' · F7BMUX');
  });
});
