export function colorWithOpacity(input: string, opacity: number): string {
  const clamped = Math.min(1, Math.max(0, opacity));
  const normalized = input.trim();

  const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(normalized);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => `${c}${c}`)
        .join('');
    }
    if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return `rgba(${r}, ${g}, ${b}, ${clamped})`;
    }
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/.exec(normalized);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      const r = Number(parts[0]);
      const g = Number(parts[1]);
      const b = Number(parts[2]);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return `rgba(${r}, ${g}, ${b}, ${clamped})`;
      }
    }
  }

  return `rgba(0, 0, 0, ${clamped})`;
}
