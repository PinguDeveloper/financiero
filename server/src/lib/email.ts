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
