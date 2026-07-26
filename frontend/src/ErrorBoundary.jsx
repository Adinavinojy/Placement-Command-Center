import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#0d0c0b', color: '#e0d8cd', height: '100vh', overflow: 'auto' }}>
          <h1 style={{ color: '#ef4444' }}>Something went wrong.</h1>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary>Click for error details</summary>
            <br />
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
