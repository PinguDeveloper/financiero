# Controle financeiro (Next.js + API)

Monorepo com **front** em `client/` (Next.js + React + Tailwind + PWA) e **API** em `server/` (Express + Prisma + **PostgreSQL**).

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

4. Suba **API + interface** (recomendado — a API sobe primeiro e o Next espera o `/health`):

```bash
npm run dev:full
```

Ou use `npm run dev` na raiz (alias para `dev:full`). Para subir os dois ao mesmo tempo **sem** esperar a API: `npm run dev:parallel`.

- Interface: **`http://127.0.0.1:5180`** (porta padrão do Next neste projeto; também `http://localhost:5180`)
- API: `http://127.0.0.1:4000/health`

**Importante:** rode sempre a partir da **pasta raiz** do repositório (`controle financeiro`). Se a tela ficar em branco, confira o console (F12); com a API desligada, use `dev:full` para o proxy `/auth` e `/api` funcionarem.

### Proxy da API no Next

Em desenvolvimento, o Next faz proxy de `/api/*` e `/auth/*` para `http://127.0.0.1:4000` por padrão. Para apontar para outra API sem expor a URL no bundle, defina:

```bash
set API_PROXY_TARGET=https://sua-api.example.com
```

Se preferir chamar a API diretamente pelo navegador, defina `NEXT_PUBLIC_API_BASE=https://sua-api.example.com` (sem barra no final).

Cadastre um usuário na tela de login e use o app.

## Build para produção

Na raiz:

```bash
npm run build
```

Isso gera `.next` no front e compila `server/dist`. Em produção, rode o front Next e a API como processos/serviços separados, ou publique o `client/` na Vercel e o `server/` no Render.

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
2. Para Hostinger com hospedagem estática, gere o front com:

```bash
cd client
set NEXT_PUBLIC_API_BASE=https://sua-api-no-render.onrender.com
npm run build:hostinger
```

3. Publique o conteúdo de `client/out` no Hostinger. Se o deploy estiver ligado ao GitHub, configure o build command como `npm install && npm run build:hostinger` dentro da pasta `client` e cadastre `NEXT_PUBLIC_API_BASE` nas variáveis do projeto.

**SEO de ativos:** a rota `/ativos/[ticker]` é SSR no Next para permitir indexação real de páginas como `/ativos/PETR4`. Em hospedagem estática comum da Hostinger, rotas dinâmicas ilimitadas não rodam no servidor. Para tráfego orgânico, hospede o front em um ambiente Next.js com servidor (Vercel, Render Web Service, VPS/Node na Hostinger) e defina `API_INTERNAL_BASE` ou `NEXT_PUBLIC_API_BASE` apontando para a API do Render.

O navegador precisa de CORS com `credentials: true`; a API já usa `CLIENT_ORIGIN` para refletir o domínio do front.

## Estrutura da API

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET /api/state` — lançamentos, parcelas e investimentos do usuário autenticado
- `POST/DELETE` em `/api/transactions`, `/api/installment-plans`, `/api/investments`
- `POST /api/installment-plans/:id/payments` — registrar parcela paga
- `GET /api/market/quote?ticker=PETR4` — proxy de cotação (brapi)

Autenticação: cookie HTTP-only `token` (JWT).
