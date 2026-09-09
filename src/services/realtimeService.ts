import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

type TableEventCallback = (payload: any) => void;

export class RealtimeService {
  private static channel: RealtimeChannel | null = null;
  private static listeners: Set<TableEventCallback> = new Set();
  private static isSubscribed = false;

  /**
   * Initializes Supabase Realtime replication listener for multi-device sync
   */
  static subscribe(): () => void {
    if (this.isSubscribed && this.channel) {
      return () => {};
    }

    try {
      this.channel = supabase
        .channel('staffpay_realtime_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          (payload) => {
            // Notify UI components via custom event
            try {
              window.dispatchEvent(new CustomEvent('staffpay_database_updated', { detail: payload }));
            } catch (e) {
              // Ignore non-DOM
            }
            this.listeners.forEach((fn) => fn(payload));
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.isSubscribed = true;
          }
        });
    } catch (err) {
      console.warn('Realtime subscription initialization notice:', err);
    }

    return () => {
      this.unsubscribe();
    };
  }

  static onEvent(callback: TableEventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  static unsubscribe(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
      this.isSubscribed = false;
    }
  }
}
