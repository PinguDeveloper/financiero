# Publicar na Vercel (front) + Render (API)

O repositório já está organizado em **`client/`** (React) e **`server/`** (Node/Express). Você pode manter um único repositório no GitHub e apontar cada serviço para a pasta certa.

## 1. Banco de dados (Render)

No plano gratuito do Render, arquivos **SQLite** não são persistentes entre reinícios. Este projeto usa **PostgreSQL** por padrão (Prisma `provider = "postgresql"` em `server/prisma/schema.prisma`).

1. Crie um banco **PostgreSQL** no Render (Add-on ou serviço Postgres) e copie a `DATABASE_URL` interna (host interno) para a variável de ambiente da API.

2. No deploy da API, use migrações versionadas (recomendado):

   ```bash
   npx prisma migrate deploy
   ```

   O `package.json` do servidor já inclui `npm run db:migrate` (= `prisma migrate deploy`). Inclua no **Build Command**, por exemplo: `npm install && npx prisma generate && npm run db:migrate && npm run build`.

   Alternativa apenas para protótipo: `npx prisma db push` (sem histórico de migração).

## 2. API no Render

| Campo no painel | Valor |
|-----------------|--------|
| **Root Directory** | `server` |
| **Build Command** | `npm install && npx prisma generate && npm run db:migrate && npm run build` |
| **Start Command** | `npm start` |

**Variáveis de ambiente** (Environment):

| Nome | Exemplo / observação |
|------|----------------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URL do Postgres (Render fornece) |
| `JWT_SECRET` | String longa e aleatória |
| `CLIENT_ORIGIN` | `https://seu-app.vercel.app` — pode listar várias separadas por vírgula: `https://app.vercel.app,http://localhost:5180` |
| `ALLOW_VERCEL_PREVIEWS` | Opcional: `1` para aceitar qualquer subdomínio `*.vercel.app` (útil para PR previews) |
| `BRAPI_TOKEN` | Opcional — [brapi.dev](https://brapi.dev) para mais limite de cotações |
| `APP_PUBLIC_URL` | URL do front na Vercel (ex.: `https://seu-app.vercel.app`) — link no e-mail de senha |
| `RESEND_API_KEY` | [Resend](https://resend.com) — envio do e-mail “esqueci a senha” |
| `EMAIL_FROM` | Ex.: `Controle Financeiro <noreply@seudominio.com>` (domínio verificado na Resend) |
| `PORT` | Render define automaticamente; não precisa fixar |

Após o deploy, anote a URL pública da API, por exemplo: `https://controle-financeiro-api.onrender.com`.

## 3. Front na Vercel

| Campo | Valor |
|-------|--------|
| **Root Directory** | `client` |
| **Framework** | Vite |
| **Build Command** | `npm run build` (padrão) |
| **Output** | `dist` |

**Variável de ambiente:**

| Nome | Valor |
|------|--------|
| `VITE_API_BASE` | URL **completa** da API, **sem** barra no final, ex.: `https://controle-financeiro-api.onrender.com` |

O front chama `fetch(\`${VITE_API_BASE}/auth/...\`)` com `credentials: 'include'`, então o cookie de sessão é gravado no **domínio da API** (Render) e enviado nas requisições para a mesma API — funciona com front e back em domínios diferentes, desde que a API use **HTTPS** e cookies com `SameSite=None` (já configurado em `NODE_ENV=production`).

## 4. E-mail em produção (Resend + domínio do site na Vercel)

O “esqueci a senha” só envia e-mail de verdade quando a Resend consegue enviar pelo **seu domínio**. O remetente de teste `onboarding@resend.dev` **não serve em produção** (só manda para o e-mail da sua conta Resend).

### Domínio: o que funciona e o que não funciona

| URL do site | Dá para verificar na Resend? |
|-------------|------------------------------|
| `https://meu-app.vercel.app` (só subdomínio Vercel) | **Não** — você não controla o DNS de `vercel.app` |
| `https://www.meusite.com` ou `https://meusite.com` (domínio **próprio** ligado ao projeto na Vercel) | **Sim** — use esse domínio na Resend |

Se hoje o site principal é só `*.vercel.app`, em **Vercel → Project → Settings → Domains** adicione um domínio que você controla (comprou em Registro.br, Cloudflare, etc.) e aponte o DNS conforme a Vercel pedir. O “domínio da Vercel” que importa para e-mail é esse **domínio customizado**, não o `vercel.app`.

### Passo a passo (produção real)

**1. Resend — adicionar domínio**

1. Acesse [resend.com/domains](https://resend.com/domains) → **Add Domain**.
2. Digite o domínio **raiz** que aparece na Vercel (ex.: `meusite.com`), não a URL da API no Render.
3. A Resend mostra registros DNS (SPF, DKIM, etc.). Copie todos.

**2. Onde colocar os DNS**

- Se o domínio usa **nameservers da Vercel**: Vercel → **Domains** → seu domínio → **DNS Records** → adicione cada registro da Resend.
- Se o domínio está no **Registro.br / Cloudflare / outro**: painel do registrador → DNS → mesmos registros.

Aguarde **Verify** na Resend (minutos a algumas horas). Status precisa ficar **Verified**.

**3. Render — variáveis da API** (serviço em `server/`)

Substitua pelos seus valores reais:

| Variável | Valor de produção |
|----------|-------------------|
| `NODE_ENV` | `production` |
| `APP_PUBLIC_URL` | URL **exata** do site principal (a que o usuário abre), ex.: `https://www.meusite.com` — **sem** `/` no final |
| `CLIENT_ORIGIN` | A mesma URL (e previews se quiser): `https://www.meusite.com,https://meusite.com` |
| `RESEND_API_KEY` | Chave em [resend.com/api-keys](https://resend.com/api-keys) (gere uma nova se a antiga vazou) |
| `EMAIL_FROM` | `Controle Financeiro <noreply@meusite.com>` — o domínio depois de `@` deve ser o **verificado** na Resend |

Salve e faça **Manual Deploy** (ou push no `main`) para a API reiniciar com as variáveis novas.

**4. Vercel — front**

| Variável | Valor |
|----------|--------|
| `VITE_API_BASE` | `https://sua-api.onrender.com` (sem barra no final) |

Redeploy do front se alterou `VITE_API_BASE`.

**5. Testar no site principal**

1. Abra o site em produção (domínio customizado ou `vercel.app`).
2. Cadastre ou use um usuário com um e-mail **qualquer** (Gmail, etc.) — depois do domínio verificado, qualquer destinatário funciona.
3. **Esqueci a senha** → deve chegar e-mail com link `https://seu-dominio/?reset=...`.
4. Se não chegar: painel Resend → **Emails** (logs), pasta spam, e logs do Render (`[email]`, `[password-reset]`).

### Erros comuns

- **`EMAIL_FROM` com domínio não verificado** → envio falha; confira Domains na Resend.
- **`APP_PUBLIC_URL` errado** (localhost ou outro domínio) → e-mail chega, mas o link abre o lugar errado.
- **`CLIENT_ORIGIN` sem a URL do site** → login/cookie pode falhar no navegador (CORS).
- Ainda usar `onboarding@resend.dev` em produção → só funciona para o e-mail da conta Resend.

## 5. Checklist rápido

- [ ] Domínio **próprio** na Vercel (não só `*.vercel.app`) ou aceitar limitação até ter um.
- [ ] Domínio **Verified** na Resend; `EMAIL_FROM` usa `@seudominio.com`.
- [ ] `APP_PUBLIC_URL` = URL do site principal na Vercel.
- [ ] `CLIENT_ORIGIN` na API = mesma URL (https).
- [ ] `VITE_API_BASE` na Vercel = URL da API no Render (https).
- [ ] `RESEND_API_KEY` no Render (nunca no repositório).
- [ ] Postgres ativo e `npm run db:migrate` no build da API.
- [ ] Testar **esqueci a senha** no site principal após redeploy.

## 6. Repositórios separados (opcional)

Se quiser **dois repositórios** Git distintos:

1. Copie a pasta `client/` para um repo novo (histórico opcional com `git subtree`).
2. Copie a pasta `server/` para outro repo.
3. Ajuste os mesmos envs acima em cada provedor.

O monorepo atual já separa **código** por pasta; a separação em dois remotes é só organização da equipe.
