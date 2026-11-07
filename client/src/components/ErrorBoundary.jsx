import { Component } from 'react';

// If any component crashes while rendering, React would show a blank white page.
// This shows a message with a reload button instead.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('UI crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="center-screen">
        <div className="stack">
          <h1>Something went wrong</h1>
          <p className="muted">Reload the page. If it keeps happening, log out and back in.</p>
          <button className="btn" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
