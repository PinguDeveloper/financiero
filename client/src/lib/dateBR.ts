/** Converte data ISO `yyyy-mm-dd` para exibição `dd/mm/aaaa`. */
export function formatISODateToBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Aceita `dd/mm/aaaa` ou 8 dígitos `ddmmaaaa`. */
export function parseBRDateToISO(s: string): string | null {
  const t = s.trim();
  let d: number;
  let mo: number;
  let y: number;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (slash) {
    d = Number(slash[1]);
    mo = Number(slash[2]);
    y = Number(slash[3]);
  } else {
    const digits = t.replace(/\D/g, "");
    if (digits.length !== 8) return null;
    d = Number(digits.slice(0, 2));
    mo = Number(digits.slice(2, 4));
    y = Number(digits.slice(4, 8));
  }
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  const mm = String(mo).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** Máscara progressiva durante a digitação (só dígitos, até 8). */
export function maskBRDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
