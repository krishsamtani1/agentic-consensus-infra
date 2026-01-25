/**
 * TRUTH-NET Event Bus
 * Pub/Sub system for real-time event distribution
 *
 * Channels:
 * - orders.*   : Order lifecycle events
 * - trades.*   : Trade execution events
 * - markets.*  : Market status changes
 * - settlements.* : Resolution and payout events
 * - agents.*   : Agent activity events
 */

type EventHandler<T = unknown> = (data: T) => Promise<void> | void;

interface EventSubscription {
  id: string;
  channel: string;
  handler: EventHandler;
  once: boolean;
}

/**
 * In-memory event bus (production would use Redis Streams)
 */
export class EventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private eventLog: Array<{ channel: string; data: unknown; timestamp: Date }> = [];
  private maxLogSize: number = 10000;
  private subscriptionIdCounter: number = 0;

  // -------------------------------------------------------------------------
  // Publishing
  // -------------------------------------------------------------------------

  /**
   * Publish an event to a channel
   */
  async publish<T>(channel: string, data: T): Promise<void> {
    // Log event
    this.logEvent(channel, data);

    // Get matching subscriptions (exact match and wildcards)
    const handlers = this.getMatchingHandlers(channel);

    // Execute handlers
    const promises = handlers.map(async (sub) => {
      try {
        await sub.handler(data);
        if (sub.once) {
          this.unsubscribe(sub.id);
        }
      } catch (error) {
        console.error(`Event handler error on ${channel}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Publish multiple events atomically
   */
  async publishBatch<T>(events: Array<{ channel: string; data: T }>): Promise<void> {
    await Promise.all(events.map(e => this.publish(e.channel, e.data)));
  }

  // -------------------------------------------------------------------------
  // Subscribing
  // -------------------------------------------------------------------------

  /**
   * Subscribe to a channel
   * Supports wildcards: orders.* matches orders.created, orders.cancelled, etc.
   */
  subscribe<T>(channel: string, handler: EventHandler<T>): string {
    const id = `sub_${++this.subscriptionIdCounter}`;
    const subscription: EventSubscription = {
      id,
      channel,
      handler: handler as EventHandler,
      once: false,
    };

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);
    }
    this.subscriptions.get(channel)!.push(subscription);

    return id;
  }

  /**
   * Subscribe to a channel, but only receive one event
   */
  once<T>(channel: string, handler: EventHandler<T>): string {
    const id = `sub_${++this.subscriptionIdCounter}`;
    const subscription: EventSubscription = {
      id,
      channel,
      handler: handler as EventHandler,
      once: true,
    };

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);
    }
    this.subscriptions.get(channel)!.push(subscription);

    return id;
  }

  /**
   * Wait for a specific event (Promise-based)
   */
  waitFor<T>(channel: string, timeout: number = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.unsubscribe(subId);
        reject(new Error(`Timeout waiting for event on ${channel}`));
      }, timeout);

      const subId = this.once<T>(channel, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [channel, subs] of this.subscriptions) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        if (subs.length === 0) {
          this.subscriptions.delete(channel);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Unsubscribe all handlers for a channel
   */
  unsubscribeAll(channel: string): void {
    this.subscriptions.delete(channel);
  }

  // -------------------------------------------------------------------------
  // Querying
  // -------------------------------------------------------------------------

  /**
   * Get recent events from the log
   */
  getRecentEvents(channel?: string, limit: number = 100): Array<{ channel: string; data: unknown; timestamp: Date }> {
    let events = this.eventLog;
    if (channel) {
      events = events.filter(e => this.matchChannel(e.channel, channel));
    }
    return events.slice(-limit);
  }

  /**
   * Get event count for a channel
   */
  getEventCount(channel?: string): number {
    if (!channel) return this.eventLog.length;
    return this.eventLog.filter(e => this.matchChannel(e.channel, channel)).length;
  }

  // -------------------------------------------------------------------------
  // Internal Methods
  // -------------------------------------------------------------------------

  private logEvent<T>(channel: string, data: T): void {
    this.eventLog.push({
      channel,
      data,
      timestamp: new Date(),
    });

    // Trim log if too large
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-Math.floor(this.maxLogSize * 0.9));
    }
  }

  private getMatchingHandlers(channel: string): EventSubscription[] {
    const handlers: EventSubscription[] = [];

    for (const [pattern, subs] of this.subscriptions) {
      if (this.matchChannel(channel, pattern)) {
        handlers.push(...subs);
      }
    }

    return handlers;
  }

  private matchChannel(channel: string, pattern: string): boolean {
    // Exact match
    if (channel === pattern) return true;

    // Wildcard match
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return channel.startsWith(prefix + '.');
    }

    // Double wildcard (match anything)
    if (pattern === '*' || pattern === '**') return true;

    return false;
  }

  /**
   * Reset event bus (for testing)
   */
  reset(): void {
    this.subscriptions.clear();
    this.eventLog = [];
    this.subscriptionIdCounter = 0;
  }
}

// Singleton instance
export const eventBus = new EventBus();
