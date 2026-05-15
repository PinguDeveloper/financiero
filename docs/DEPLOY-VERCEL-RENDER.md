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

## 4. Checklist rápido

- [ ] `CLIENT_ORIGIN` na API = URL exata do site na Vercel (https).
- [ ] `VITE_API_BASE` na Vercel = URL da API no Render (https).
- [ ] Postgres ativo e `npm run db:migrate` (ou `prisma migrate deploy`) aplicado no build.
- [ ] Testar cadastro, login e uma compra de investimento após o deploy.

## 5. Repositórios separados (opcional)

Se quiser **dois repositórios** Git distintos:

1. Copie a pasta `client/` para um repo novo (histórico opcional com `git subtree`).
2. Copie a pasta `server/` para outro repo.
3. Ajuste os mesmos envs acima em cada provedor.

O monorepo atual já separa **código** por pasta; a separação em dois remotes é só organização da equipe.
