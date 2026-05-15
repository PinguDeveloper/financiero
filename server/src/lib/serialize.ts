export function decimalToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  return Number(String(value));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
