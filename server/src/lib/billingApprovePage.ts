import { centsToReais } from "./pixBrCode.js";

export function renderApprovePage(opts: {
  token: string;
  email: string;
  amountCents: number | null;
  error?: string;
  success?: string;
}): string {
  const amount =
    opts.amountCents != null
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
          centsToReais(opts.amountCents)
        )
      : "—";

  const errorBlock = opts.error
    ? `<p style="color:#f87171;margin:0 0 16px">${escapeHtml(opts.error)}</p>`
    : "";
  const successBlock = opts.success
    ? `<p style="color:#4ade80;margin:0 0 16px">${escapeHtml(opts.success)}</p>`
    : "";

  const form =
    opts.success == null
      ? `<form method="post" action="/api/billing/admin/approve" style="margin-top:24px">
  <input type="hidden" name="token" value="${escapeHtml(opts.token)}"/>
  <button type="submit" style="width:100%;background:#3b82f6;color:#fff;border:none;padding:14px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer">
    Confirmar PIX e enviar código ao cliente
  </button>
</form>
<p style="color:#64748b;font-size:13px;margin-top:16px">Só clique após ver o PIX de <strong>${escapeHtml(amount)}</strong> no seu extrato.</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Aprovar PIX — Atlas Invest</title>
</head>
<body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:24px;margin:0">
  <div style="max-width:440px;margin:0 auto;background:#1e293b;border-radius:16px;padding:28px;border:1px solid #334155">
    <p style="margin:0;font-size:12px;text-transform:uppercase;color:#60a5fa;letter-spacing:.1em">Atlas Invest · Admin</p>
    <h1 style="margin:12px 0 8px;font-size:22px;color:#f8fafc">Aprovar entrada</h1>
    ${errorBlock}
    ${successBlock}
    <dl style="margin:0;color:#94a3b8;font-size:15px;line-height:1.8">
      <dt style="color:#64748b;font-size:12px">Cliente</dt>
      <dd style="margin:0 0 12px;color:#f1f5f9">${escapeHtml(opts.email)}</dd>
      <dt style="color:#64748b;font-size:12px">Valor esperado no PIX</dt>
      <dd style="margin:0;color:#f1f5f9;font-weight:600">${escapeHtml(amount)}</dd>
    </dl>
    ${form}
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
