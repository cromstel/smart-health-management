import { API_BASE_URL } from '@/config/api';

const ANALYTICS_ENABLED =
  import.meta.env.VITE_ANALYTICS_ENABLED !== 'false' &&
  import.meta.env.VITE_ANALYTICS_ENABLED !== undefined;

export interface AnalyticsEvent {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

class AnalyticsService {
  // Session-scoped only: never persisted to localStorage (PHI-at-rest rule).
  private offlineQueue: AnalyticsEvent[] = [];

  isEnabled(): boolean {
    return ANALYTICS_ENABLED;
  }

  trackEvent(type: string, payload: any) {
    if (!this.isEnabled()) return;
    const event: AnalyticsEvent = {
      id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
      type,
      payload,
      timestamp: Date.now(),
    };
    if (navigator.onLine) {
      this.sendEventToServer(event);
    } else {
      this.queueOfflineEvent(event);
    }
  }

  private async sendEventToServer(event: AnalyticsEvent) {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!response.ok) this.queueOfflineEvent(event);
    } catch (e) {
      this.queueOfflineEvent(event);
    }
  }

  private queueOfflineEvent(event: AnalyticsEvent) {
    this.offlineQueue.push(event);
  }

  private getOfflineQueue(): AnalyticsEvent[] {
    return [...this.offlineQueue];
  }

  async syncPendingEvents() {
    if (!this.isEnabled()) return;
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return;
    const remaining: AnalyticsEvent[] = [];
    for (const event of queue) {
      try {
        const response = await fetch(`${API_BASE_URL}/analytics/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
        if (!response.ok) remaining.push(event);
      } catch (e) {
        remaining.push(event);
      }
    }
    this.offlineQueue = remaining;
  }
}

export const analyticsService = new AnalyticsService();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => analyticsService.syncPendingEvents());
}
