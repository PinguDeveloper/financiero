import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-4 text-center text-slate-200">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">Página não encontrada</p>
      <h1 className="font-display text-3xl font-bold text-white">Atlas Invest</h1>
      <Link href="/" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white">
        Voltar ao início
      </Link>
    </main>
  );
}
