export function formatVariantResistance(value: string): string {
  const text = value.trim();
  // Composite names can contain model numbers (N80/Ni90); only a decimal is a resistance there.
  const decimalResistance = /\b\d+[.,]\d+\b(?:\s*(?:Ω|ohms?))?/i;
  const numericResistance = /^\d+(?:\s*(?:Ω|ohms?))?$/i;
  const pattern = decimalResistance.test(text) ? decimalResistance : numericResistance;
  return text.replace(pattern, match => `${match.replace(/\s*(?:Ω|ohms?)$/i, '')}Ω`);
}
