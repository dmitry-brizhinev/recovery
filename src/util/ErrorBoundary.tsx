import * as React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: any;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: any) {
    // Update state so the next render will show the fallback UI.
    return { error: error?.message || '(no message)' };
  }
  
  render() {
    if (this.state.error) {
      return <h1>Something went wrong: {JSON.stringify(this.state.error)}</h1>;
    }

    return this.props.children; 
  }
}