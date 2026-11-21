import { Component, type ReactNode } from "react";

// if the ui crashes show the error, not a black screen
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[lyrisense] UI crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="glow-bg flex min-h-full items-center justify-center p-6">
        <div className="glass max-w-lg rounded-3xl p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Something broke</h1>
          <p className="mt-3 break-words font-mono text-xs text-red-700">{this.state.error.message}</p>
          <button
            onClick={() => location.reload()}
            className="mt-6 rounded-2xl bg-gradient-to-r from-violet via-pink to-amber px-6 py-2.5 font-display font-semibold text-ink"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
