# Controle financeiro (React + API)

Monorepo com **front** em `client/` (Vite + React + Tailwind) e **API** em `server/` (Express + Prisma + **PostgreSQL**).

O banco local sobe com **Docker** (`docker-compose.yml` na raiz). Para desenvolvimento rápido sem Docker, ainda é possível voltar o `provider` no Prisma para `sqlite` e usar `DATABASE_URL=file:./prisma/dev.db` (legado).

**Deploy (Vercel + Render):** veja o passo a passo em [`docs/DEPLOY-VERCEL-RENDER.md`](docs/DEPLOY-VERCEL-RENDER.md). O front usa `client/vercel.json`; há um exemplo de `render.yaml` na raiz para a API.

## Desenvolvimento

1. Na raiz do repositório:

```bash
npm install
```

2. Copie variáveis da API (se ainda não existir):

```bash
copy server\.env.example server\.env
```

Ajuste `JWT_SECRET` em `server/.env`. O exemplo já aponta para o **Postgres** do Docker (`finance` / `finance` / `controle_financeiro` na porta `5432`).

3. Suba o PostgreSQL e aplique o schema:

```bash
npm run docker:db
npm run db:migrate
```

Na primeira vez, aguarde o healthcheck do Postgres (alguns segundos) antes do `db:migrate`.

**Sem Docker:** use um Postgres gerenciado ou local, defina `DATABASE_URL` e rode `npm run db:migrate`. Alternativa legada: SQLite — veja comentários em `server/.env.example` e troque `provider` em `server/prisma/schema.prisma` para `sqlite`.

4. Suba **API + interface** (recomendado — a API sobe primeiro e o Vite espera o `/health`):

```bash
npm run dev:full
```

Ou use `npm run dev` na raiz (alias para `dev:full`). Para subir os dois ao mesmo tempo **sem** esperar a API: `npm run dev:parallel`.

- Interface: **`http://127.0.0.1:5180`** (porta padrão do Vite neste projeto; também `http://localhost:5180`)
- API: `http://127.0.0.1:4000/health`

**Importante:** rode sempre a partir da **pasta raiz** do repositório (`controle financeiro`), não use um `vite` antigo na raiz sem a pasta `client/`. Se a tela ficar em branco, confira o console (F12); com a API desligada, use `dev:full` para o proxy `/auth` e `/api` funcionarem.

### Erro 404 em `localhost:5173` (Firefox ou outro navegador)

A porta **5173** é muito usada; outro programa pode estar escutando aí e responder **404** (não é o Vite — o Vite deste projeto sobe por padrão na **5180**).

1. Pare o dev (Ctrl+C), rode de novo **`npm run dev`** na raiz e abra a URL que o terminal mostrar, em geral **`http://127.0.0.1:5180/`**.
2. Inclua no `server/.env` a origem do front em **`CLIENT_ORIGIN`** (o exemplo em `server/.env.example` já lista `5180` e `5173`).
3. Se quiser voltar à porta **5173** depois de liberá-la: `set VITE_DEV_PORT=5173` (PowerShell) antes de `npm run dev`.
4. Confirme que **`PORT=4000`** na API — não use `PORT=5173` no servidor.
5. Porta livre na LAN: `set VITE_DEV_BIND=0.0.0.0` antes de subir o Vite.

Cadastre um usuário na tela de login e use o app.

## Build para produção (um só processo)

Na raiz:

```bash
npm run build
```

Isso gera `client/dist` e compila `server/dist`. Defina `CLIENT_DIST` apontando para o build do front (o padrão no código é `../client/dist` quando o processo é iniciado a partir da pasta `server/`).

Exemplo a partir da pasta `server/`:

```bash
cd server
set NODE_ENV=production
set CLIENT_DIST=..\client\dist
node dist\index.js
```

A API passa a servir o front estático e as rotas `/api` e `/auth` no mesmo host/porta — ideal atrás de um reverse proxy (Nginx, Caddy) com HTTPS.

Variáveis importantes em produção:

| Variável | Descrição |
|----------|-----------|
| `JWT_SECRET` | Chave forte para assinar o cookie de sessão |
| `CLIENT_ORIGIN` | URL exata do front (CORS + cookies); se tudo no mesmo domínio, use essa URL |
| `DATABASE_URL` | **PostgreSQL** em dev: ver `server/.env.example`. Em produção: URL do provedor (`postgresql://USER:PASS@HOST:5432/DB?schema=public`). |
| `BRAPI_TOKEN` | Opcional, para cotações B3 via brapi.dev |
| `PORT` | Porta da API (padrão 4000) |

## Front em domínio separado

1. Faça deploy da API com HTTPS.
2. Faça deploy do `client/dist` em hospedagem estática.
3. No build do client, defina `VITE_API_BASE=https://sua-api.example.com` (sem barra no final).

O navegador precisa de CORS com `credentials: true`; a API já usa `CLIENT_ORIGIN` para refletir o domínio do front.

## Estrutura da API

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET /api/state` — lançamentos, parcelas e investimentos do usuário autenticado
- `POST/DELETE` em `/api/transactions`, `/api/installment-plans`, `/api/investments`
- `POST /api/installment-plans/:id/payments` — registrar parcela paga
- `GET /api/market/quote?ticker=PETR4` — proxy de cotação (brapi)

Autenticação: cookie HTTP-only `token` (JWT).
