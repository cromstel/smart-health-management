import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unexpected error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 flex items-center justify-center min-h-[300px] w-full">
          <Card className="max-w-md border-destructive/40 bg-destructive/5 text-foreground shadow-lg">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto p-3 rounded-full bg-destructive/10 text-destructive w-fit mb-2">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <CardTitle className="text-lg font-bold">
                {this.props.fallbackTitle || 'Something went wrong in this module'}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                An unexpected UI rendering error occurred. The system isolated this module to prevent full application crash.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {this.state.error?.message && (
                <div className="p-2.5 rounded bg-muted font-mono text-[11px] text-destructive overflow-x-auto max-h-24">
                  {this.state.error.message}
                </div>
              )}
              <Button
                onClick={this.handleReset}
                size="sm"
                className="w-full bg-primary text-primary-foreground font-semibold gap-1.5 h-9"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reload Module</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
