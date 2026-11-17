// Keeps one broken section from blanking the whole panel, and shows what went wrong.
import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[potato] panel section crashed', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="pm-speech pm-speech--warn">
        <p>
          <strong>Oops, this part broke.</strong> <code className="pm-code">{error.message}</code>
        </p>
        <button className="pm-btn pm-btn--small" onClick={() => this.setState({ error: null })}>
          ↻ Try again
        </button>
      </div>
    );
  }
}
