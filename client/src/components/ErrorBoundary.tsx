import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-16 text-center">
          <h1 className="font-display text-xl font-bold text-expense">Algo deu errado</h1>
          <p className="mt-3 max-w-lg text-sm text-slate-400">
            Atualize a página. Se o problema continuar, entre em contato com o suporte e informe
            o horário em que ocorreu.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
