import { createHash } from "crypto";

/** CRC16-CCITT-FALSE (padrão PIX EMV) */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function emv(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function normalizePixKey(key: string): string {
  const k = key.trim();
  if (k.includes("@")) return k.toLowerCase();
  const digits = k.replace(/\D/g, "");
  if (digits.length === 11 || digits.length === 14) return digits;
  if (digits.length >= 10 && digits.length <= 13 && !k.includes("-")) {
    const phone = digits.startsWith("55") ? digits : `55${digits}`;
    return `+${phone}`;
  }
  return k;
}

export type PixChargeInput = {
  pixKey: string;
  merchantName: string;
  merchantCity?: string;
  amount: number;
  txid?: string;
};

export function buildPixCopyPaste(input: PixChargeInput): string {
  const key = normalizePixKey(input.pixKey);
  const name = input.merchantName.trim().slice(0, 25).toUpperCase() || "RECEBEDOR";
  const city = (input.merchantCity?.trim() || "BRASILIA").slice(0, 15).toUpperCase();
  const amountStr = input.amount.toFixed(2);

  const gui = emv("00", "br.gov.bcb.pix") + emv("01", key);
  const merchantAccount = emv("26", gui);
  const txid = (input.txid?.trim() || "***").slice(0, 25);
  const additional = emv("05", txid);

  let payload =
    emv("00", "01") +
    emv("01", "11") +
    merchantAccount +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", amountStr) +
    emv("58", "BR") +
    emv("59", name) +
    emv("60", city) +
    emv("62", additional);

  payload += "6304";
  return payload + crc16(payload);
}

/** Centavos totais com sufixo único (1–98) para identificar pagador no extrato */
export function uniqueAmountCentsForUser(userId: string, baseReais: number): number {
  const baseCents = Math.round(baseReais * 100);
  const hash = createHash("sha256").update(userId).digest();
  const extra = (hash[0]! % 98) + 1;
  return baseCents + extra;
}

export function centsToReais(cents: number): number {
  return Math.round(cents) / 100;
}
