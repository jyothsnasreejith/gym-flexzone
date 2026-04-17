import React from "react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        // TODO: Integrate with your logging utility (e.g., logger.error)
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div className="p-10 text-center bg-red-50 border border-red-200 rounded-2xl m-4">
                    <h2 className="text-2xl font-bold text-red-700 mb-2">Something went wrong.</h2>
                    <p className="text-red-600 mb-4">
                        The application encountered an unexpected error.
                    </p>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false });
                            window.location.reload();
                        }}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition"
                    >
                        Refresh Page
                    </button>
                    <details className="mt-4 text-left text-xs text-red-500 cursor-pointer">
                        <summary>Error Details</summary>
                        <pre className="mt-2 p-2 bg-card rounded border overflow-auto max-h-40">
                            {this.state.error?.toString()}
                        </pre>
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
