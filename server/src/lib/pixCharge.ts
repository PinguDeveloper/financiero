import QRCode from "qrcode";
import {
  buildPixCopyPaste,
  centsToReais,
  uniqueAmountCentsForUser,
} from "./pixBrCode.js";
function planPrice(): number {
  return Number(process.env.MANUAL_PLAN_PRICE ?? process.env.STRIPE_MONTHLY_PRICE ?? "5");
}

function planDays(): number {
  return Number(process.env.MANUAL_PLAN_DAYS ?? "30") || 30;
}

export type PixChargePayload = {
  amount: number;
  amountCents: number;
  copyPaste: string;
  qrDataUrl: string;
  recipient: string;
  days: number;
};

export async function buildPixChargeForUser(userId: string): Promise<PixChargePayload | null> {
  const pixKey = process.env.PIX_KEY?.trim();
  if (!pixKey) return null;

  const recipient = process.env.PIX_RECIPIENT_NAME?.trim() || "Atlas Invest";
  const city = process.env.PIX_CITY?.trim() || "BRASILIA";
  const base = planPrice();
  const amountCents = uniqueAmountCentsForUser(userId, base);
  const amount = centsToReais(amountCents);

  const copyPaste = buildPixCopyPaste({
    pixKey,
    merchantName: recipient,
    merchantCity: city,
    amount,
    txid: userId.replace(/-/g, "").slice(0, 25),
  });

  const qrDataUrl = await QRCode.toDataURL(copyPaste, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
  });

  return {
    amount,
    amountCents,
    copyPaste,
    qrDataUrl,
    recipient,
    days: planDays(),
  };
}
