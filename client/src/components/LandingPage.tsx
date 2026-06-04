import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { UserAccountMenu } from "./UserAccountMenu";

const PLANS = [
  {
    id: "trial",
    name: "Teste grátis",
    price: "R$ 0",
    period: "10 minutos",
    features: [
      "Acesso completo ao painel",
      "Transações, parcelas e investimentos",
      "Ideal para conhecer a plataforma",
    ],
    highlight: false,
  },
  {
    id: "monthly",
    name: "Mensal",
    price: "R$ 5,00",
    period: "/ mês",
    features: [
      "Uso ilimitado após o teste",
      "Suporte por e-mail",
      "Atualizações incluídas",
    ],
    highlight: true,
  },
] as const;

const BENEFITS = [
  {
    title: "Visão clara das finanças",
    text: "Entradas, saídas e saldo em um painel objetivo, sem planilhas soltas.",
  },
  {
    title: "Parcelas sob controle",
    text: "Cadastre compras parceladas e acompanhe o que já foi pago e o que falta.",
  },
  {
    title: "Investimentos integrados",
    text: "Registre aportes, proventos e acompanhe a evolução do patrimônio.",
  },
  {
    title: "Caixinhas e metas",
    text: "Separe valores por objetivo e deposite quando quiser.",
  },
];

function planCta(planId: (typeof PLANS)[number]["id"], loggedIn: boolean) {
  if (!loggedIn) {
    return {
      label: planId === "trial" ? "Começar grátis" : "Criar conta e testar",
      to: "/cadastro",
      hint:
        planId === "monthly"
          ? "Primeiro o teste de 10 minutos; depois você assina por PIX."
          : undefined,
    };
  }
  if (planId === "trial") {
    return { label: "Abrir meu painel", to: "/app", hint: undefined };
  }
  return {
    label: "Ver assinatura no app",
    to: "/app?tab=assinatura",
    hint: "Pagamento PIX só dentro do app, após o teste.",
  };
}

export function LandingPage() {
  const { ready, user } = useAuth();
  const loggedIn = Boolean(user);

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      <header className="border-b border-surface-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="font-display text-lg font-bold text-white">
            Atlas Invest
          </Link>
          <nav className="flex items-center gap-3 sm:gap-6">
            <a href="#sobre" className="hidden text-sm text-slate-400 hover:text-white sm:inline">
              Quem somos
            </a>
            <a href="#beneficios" className="hidden text-sm text-slate-400 hover:text-white sm:inline">
              Benefícios
            </a>
            <a href="#planos" className="hidden text-sm text-slate-400 hover:text-white sm:inline">
              Planos
            </a>
            {ready && loggedIn ? (
              <>
                <Link
                  href="/app"
                  className="hidden rounded-xl border border-surface-border px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white sm:inline"
                >
                  Meu painel
                </Link>
                <UserAccountMenu showAppLink />
              </>
            ) : ready ? (
              <>
                <Link
                  href="/login"
                  className="rounded-xl border border-surface-border px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/25 hover:opacity-90"
                >
                  Criar conta
                </Link>
              </>
            ) : (
              <div className="h-9 w-24 animate-pulse rounded-xl bg-surface-raised" />
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            Controle financeiro pessoal
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
            Organize seu dinheiro com clareza e confiança
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-400">
            O Atlas Invest reúne gastos, parcelas, investimentos e caixinhas em um só lugar.
            Teste grátis por 10 minutos e assine quando quiser continuar.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href={loggedIn ? "/app" : "/cadastro"}
              className="rounded-xl bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent/30 hover:opacity-90"
            >
              {loggedIn ? "Ir para o painel" : "Começar teste grátis"}
            </Link>
            {!loggedIn ? (
              <Link
                href="/login"
                className="rounded-xl border border-surface-border bg-surface-raised px-8 py-3.5 text-base font-semibold text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Já tenho conta
              </Link>
            ) : null}
          </div>
        </motion.div>
      </section>

      <section id="sobre" className="border-t border-surface-border bg-surface-raised/50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Quem somos</h2>
          <p className="mt-6 max-w-3xl text-slate-400 leading-relaxed">
            Somos uma plataforma focada em ajudar pessoas e pequenos negócios a enxergar para onde
            vai o dinheiro — sem complicação. O Atlas Invest nasceu da necessidade de ter um painel
            simples, seguro e acessível, com cadastro verificado por e-mail e planos transparentes.
          </p>
        </div>
      </section>

      <section id="beneficios" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Benefícios</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6"
              >
                <h3 className="font-display text-lg font-semibold text-white">{b.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{b.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="border-t border-surface-border bg-surface-raised/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-2xl font-bold text-white sm:text-3xl">
            Planos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-slate-400">
            {loggedIn
              ? "Você já está logado. O pagamento PIX fica na aba Assinatura do app, após o teste."
              : "Crie a conta, teste 10 minutos grátis e depois assine por PIX no app."}
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 sm:max-w-3xl sm:mx-auto">
            {PLANS.map((plan) => {
              const cta = planCta(plan.id, loggedIn);
              return (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-2xl border p-8 ${
                    plan.highlight
                      ? "border-accent/50 bg-accent/5 shadow-xl shadow-accent/10"
                      : "border-surface-border bg-surface-raised"
                  }`}
                >
                  <h3 className="font-display text-xl font-bold text-white">{plan.name}</h3>
                  <div className="mt-4">
                    <p className="text-3xl font-bold text-white">{plan.price}</p>
                    <p className="mt-1 text-sm text-slate-500">{plan.period}</p>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-400">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-accent">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {cta.hint ? (
                    <p className="mt-4 text-xs text-slate-500">{cta.hint}</p>
                  ) : null}
                  <Link
                    href={cta.to}
                    className={`mt-6 block rounded-xl py-3 text-center text-sm font-semibold transition ${
                      plan.highlight
                        ? "bg-accent text-white hover:opacity-90"
                        : "border border-surface-border text-slate-300 hover:border-slate-500 hover:text-white"
                    }`}
                  >
                    {cta.label}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-surface-border py-10 text-center text-xs text-slate-600">
        Atlas Invest · Controle financeiro
      </footer>
    </div>
  );
}
