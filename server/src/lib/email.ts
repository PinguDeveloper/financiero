import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM?.trim() || "Controle Financeiro <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function buildResetEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(135deg,#1e3a5f 0%,#1e293b 100%);">
          <p style="margin:0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:#60a5fa;font-weight:600;">Controle financeiro</p>
          <h1 style="margin:12px 0 0;font-size:24px;color:#f8fafc;font-weight:700;">Redefinir sua senha</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#cbd5e1;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 20px;">Recebemos um pedido para criar uma nova senha da sua conta. Siga os passos abaixo:</p>
          <ol style="margin:0 0 24px;padding-left:20px;color:#94a3b8;">
            <li style="margin-bottom:8px;">Clique no botão abaixo (válido por <strong style="color:#e2e8f0;">1 hora</strong>)</li>
            <li style="margin-bottom:8px;">Escolha uma senha com no mínimo 8 caracteres</li>
            <li>Faça login com a nova senha</li>
          </ol>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${resetUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;box-shadow:0 4px 14px rgba(59,130,246,0.4);">Criar nova senha</a>
          </td></tr></table>
          <p style="margin:0 0 12px;font-size:13px;color:#64748b;">Se o botão não funcionar, copie e cole este link no navegador:</p>
          <p style="margin:0;word-break:break-all;font-size:12px;color:#60a5fa;">${resetUrl}</p>
          <hr style="border:none;border-top:1px solid #334155;margin:28px 0 20px;"/>
          <p style="margin:0;font-size:13px;color:#64748b;">Não pediu esta alteração? Ignore este e-mail — sua senha continua a mesma.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#0f172a;text-align:center;font-size:11px;color:#475569;">
          Controle financeiro · Mensagem automática
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildResetEmailText(resetUrl: string): string {
  return `Controle financeiro — Redefinir senha

Recebemos um pedido para alterar a senha da sua conta.

1. Acesse o link abaixo (válido por 1 hora)
2. Defina uma nova senha com no mínimo 8 caracteres
3. Entre no app com a nova senha

${resetUrl}

Se você não pediu isso, ignore este e-mail.

— Controle financeiro`;
}

export async function sendVerificationCodeEmail(
  to: string,
  code: string
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY não configurada no servidor" };
  }

  const html = `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155">
  <p style="margin:0;font-size:12px;text-transform:uppercase;color:#60a5fa;letter-spacing:.1em">Atlas Invest</p>
  <h1 style="color:#f8fafc;font-size:22px;margin:16px 0 8px">Confirme seu cadastro</h1>
  <p style="color:#94a3b8;line-height:1.6">Use o código abaixo na tela de cadastro. Válido por <strong>15 minutos</strong>.</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;color:#3b82f6;margin:28px 0">${code}</p>
  <p style="color:#64748b;font-size:13px">Se você não solicitou este cadastro, ignore este e-mail.</p>
  </div></body></html>`;

  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: "Código de verificação — Atlas Invest",
      html,
      text: `Seu código de verificação Atlas Invest: ${code}\nVálido por 15 minutos.`,
    });
    if (error) {
      console.error("[email] Resend:", error);
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar e-mail";
    console.error("[email]", msg);
    return { sent: false, error: msg };
  }
}

export async function sendSubscriptionVoucherEmail(
  to: string,
  code: string,
  days: number,
  appUrl: string
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY não configurada no servidor" };
  }

  const html = `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155">
  <p style="margin:0;font-size:12px;text-transform:uppercase;color:#60a5fa;letter-spacing:.1em">Atlas Invest</p>
  <h1 style="color:#f8fafc;font-size:22px;margin:16px 0 8px">Seu código de liberação</h1>
  <p style="color:#94a3b8;line-height:1.6">Obrigado pelo PIX. Use o código abaixo na aba <strong>Assinatura</strong> do app para ativar <strong>${days} dias</strong> de acesso.</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:6px;text-align:center;color:#3b82f6;margin:28px 0;font-family:monospace">${code}</p>
  <p style="text-align:center;margin:0 0 20px"><a href="${appUrl}/app" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px">Abrir o Atlas Invest</a></p>
  <p style="color:#64748b;font-size:13px">O código é de uso único e vale apenas para este e-mail cadastrado.</p>
  </div></body></html>`;

  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: "Código de liberação — Atlas Invest",
      html,
      text: `Seu código Atlas Invest: ${code}\nAtiva ${days} dias de acesso. Cole na aba Assinatura: ${appUrl}/app`,
    });
    if (error) {
      console.error("[email] Resend voucher:", error);
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar e-mail";
    console.error("[email]", msg);
    return { sent: false, error: msg };
  }
}

export async function sendBillingAdminNotifyEmail(
  adminTo: string,
  userEmail: string,
  approveUrl: string,
  amountLabel: string
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY não configurada" };
  }
  const resend = new Resend(apiKey);
  const html = `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155">
  <p style="margin:0;font-size:12px;text-transform:uppercase;color:#60a5fa">Atlas Invest · Admin</p>
  <h1 style="color:#f8fafc;font-size:20px;margin:16px 0 8px">PIX para aprovar</h1>
  <p style="color:#94a3b8;line-height:1.6"><strong>${userEmail}</strong> informou que já fez o PIX.</p>
  <p style="color:#94a3b8">Valor esperado: <strong style="color:#e2e8f0">${amountLabel}</strong></p>
  <p style="color:#64748b;font-size:14px">Confira no app do seu banco. Se entrou, clique abaixo para enviar o código de liberação ao e-mail do cliente.</p>
  <p style="text-align:center;margin:28px 0"><a href="${approveUrl}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px">Aprovar e enviar código</a></p>
  <p style="color:#64748b;font-size:12px;word-break:break-all">${approveUrl}</p>
  </div></body></html>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [adminTo],
      subject: `PIX pendente — ${userEmail} (${amountLabel})`,
      html,
      text: `${userEmail} pediu liberação após PIX (${amountLabel}). Aprove em: ${approveUrl}`,
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Falha ao enviar" };
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY não configurada no servidor" };
  }

  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: "Redefinir senha — Controle financeiro",
      html: buildResetEmailHtml(resetUrl),
      text: buildResetEmailText(resetUrl),
    });
    if (error) {
      console.error("[email] Resend:", error);
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar e-mail";
    console.error("[email]", msg);
    return { sent: false, error: msg };
  }
}
