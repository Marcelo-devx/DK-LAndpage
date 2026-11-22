import { describe, expect, it } from 'vitest';
import { formatVariantResistance } from './variant-resistance';

const cases = [
  ["N80 0.50", "N80 0.50Ω"],
  ["Clapton 0.45 Ni90", "Clapton 0.45Ω Ni90"],
  ["Fused Clapton 0.27 Ni90", "Fused Clapton 0.27Ω Ni90"],
  ["Tricore 0.25 SS", "Tricore 0.25Ω SS"],
  ["Dual Core Fused 0.38", "Dual Core Fused 0.38Ω"],
  ["Dual Core Fused Clapton 0.62", "Dual Core Fused Clapton 0.62Ω"],
  ["0.8 Mesh", "0.8Ω Mesh"],
  ["1.2 Regular", "1.2Ω Regular"],
  ["0.38", "0.38Ω"],
  ["0,38", "0,38Ω"],
  ["0.38Ω", "0.38Ω"],
  ["0.38 ohms", "0.38Ω"],
  ["Clapton 0.45Ω Ni90", "Clapton 0.45Ω Ni90"],
  ["1", "1Ω"],
  ["1 ohm", "1Ω"],
  ["N80", "N80"],
  ["Rosca 510", "Rosca 510"],
  [" 0.38 ", "0.38Ω"]
];

describe('formatVariantResistance', () => {
  it.each(cases)('formats %s as %s without losing the model name', (input, expected) => {
    expect(formatVariantResistance(input)).toBe(expected);
    expect(formatVariantResistance(expected)).toBe(expected);
  });
});
