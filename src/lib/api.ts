import { toast } from 'sonner';
import { ZodError, type ZodIssue } from 'zod';
import { ApiError } from '@/services/api';

/**
 * The message a failed action is shown with.
 *
 * The API confines every clinical record to the caller's own hospital and
 * answers a record of another hospital as "not found" (404) rather than
 * "forbidden" (403). A 404 on an action therefore means "that record is not
 * available to you" -- it is not a fault and retrying it will not change the
 * answer -- so it is reported as that rather than as a failure to retry.
 */
export function describeActionFailure(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'That record is not available to you. It may belong to another hospital.';
    }
    if (error.status === 403) {
      return 'You do not have permission to do that.';
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

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
