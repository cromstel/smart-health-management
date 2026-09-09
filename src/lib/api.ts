import { toast } from 'sonner';
import { ZodError, type ZodIssue } from 'zod';

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  statusCode?: number;
}

interface ApiMetrics {
  totalRequests: number;
  totalErrors: number;
  totalLatencyMs: number;
  recentLogs: { endpoint: string; duration: number; success: boolean; timestamp: number }[];
}

const apiMetrics: ApiMetrics = {
  totalRequests: 0,
  totalErrors: 0,
  totalLatencyMs: 0,
  recentLogs: [],
};

export function getApiMetrics() {
  const avgLatency = apiMetrics.totalRequests > 0 ? Math.round(apiMetrics.totalLatencyMs / apiMetrics.totalRequests) : 0;
  const errorRate = apiMetrics.totalRequests > 0 ? ((apiMetrics.totalErrors / apiMetrics.totalRequests) * 100).toFixed(1) : '0.0';
  return {
    totalRequests: apiMetrics.totalRequests,
    totalErrors: apiMetrics.totalErrors,
    avgLatency,
    errorRate: Number(errorRate),
    recentLogs: apiMetrics.recentLogs,
  };
}

export function handleApiError(error: unknown): never {
  if (error instanceof ZodError) {
    const errorDetails = error.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
    const message = `API Data Validation Error: ${errorDetails}`;
    console.error(message, error);
    toast.error('Data Validation Failed', {
      description: 'The server response did not match the expected schema format.',
    });
    throw new Error(message);
  }

  if (error instanceof Error) {
    console.error('API Request Error:', error.message);
    toast.error('Operation Failed', {
      description: error.message || 'An unexpected error occurred during the API request.',
    });
    throw error;
  }

  const genericMessage = 'An unknown network error occurred.';
  console.error(genericMessage, error);
  toast.error('Network Error', {
    description: genericMessage,
  });
  throw new Error(genericMessage);
}

export async function safeApiCall<T>(apiFn: () => Promise<T>, endpointName = 'API Request'): Promise<T> {
  const start = performance.now();
  apiMetrics.totalRequests++;
  try {
    const result = await apiFn();
    const duration = Math.round(performance.now() - start);
    apiMetrics.totalLatencyMs += duration;
    apiMetrics.recentLogs.unshift({ endpoint: endpointName, duration, success: true, timestamp: Date.now() });
    if (apiMetrics.recentLogs.length > 25) apiMetrics.recentLogs.pop();
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    apiMetrics.totalLatencyMs += duration;
    apiMetrics.totalErrors++;
    apiMetrics.recentLogs.unshift({ endpoint: endpointName, duration, success: false, timestamp: Date.now() });
    if (apiMetrics.recentLogs.length > 25) apiMetrics.recentLogs.pop();
    return handleApiError(error);
  }
}
