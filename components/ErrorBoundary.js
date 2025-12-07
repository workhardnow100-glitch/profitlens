// components/ErrorBoundary.js
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service here
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded">
          <h2 className="text-lg font-semibold text-red-700 mb-2">
            Something went wrong.
          </h2>
          <p className="text-sm text-red-600">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
