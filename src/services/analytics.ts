// Check if analytics is enabled via configuration flag
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
  private offlineQueueKey = 'offline_analytics_events';

  isEnabled(): boolean {
    return ANALYTICS_ENABLED;
  }

  // Queue event for sync
  trackEvent(type: string, payload: any) {
    if (!this.isEnabled()) {
      return;
    }

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
      await fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).catch(() => {
        this.queueOfflineEvent(event);
      });
    } catch (e) {
      this.queueOfflineEvent(event);
    }
  }

  private queueOfflineEvent(event: AnalyticsEvent) {
    try {
      const queue = this.getOfflineQueue();
      queue.push(event);
      localStorage.setItem(this.offlineQueueKey, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to queue analytics event offline:', e);
    }
  }

  private getOfflineQueue(): AnalyticsEvent[] {
    try {
      const data = localStorage.getItem(this.offlineQueueKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Sync queued events when network is restored
  async syncPendingEvents() {
    if (!this.isEnabled()) return;

    const queue = this.getOfflineQueue();
    if (queue.length === 0) return;

    const remainingEvents: AnalyticsEvent[] = [];

    for (const event of queue) {
      try {
        await fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        });
      } catch (e) {
        remainingEvents.push(event);
      }
    }

    localStorage.setItem(this.offlineQueueKey, JSON.stringify(remainingEvents));
  }
}

export const analyticsService = new AnalyticsService();

// Set up online restore listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    analyticsService.syncPendingEvents();
  });
}
