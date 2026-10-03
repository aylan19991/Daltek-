import { useEffect, useRef, useState } from 'react';
import { QueueTicket, Establishment } from '../types';
import { fetchQueue } from './api';

interface RealtimeCallbacks {
  onQueueUpdate?: (queue: QueueTicket[], activeTicket: QueueTicket | null) => void;
  onTicketCalled?: (calledTicket: QueueTicket, queue: QueueTicket[]) => void;
  onEstablishmentUpdate?: (establishment: Establishment) => void;
  onStatusChange?: (isOnline: boolean) => void;
}

export function useRealtime(establishmentId: string | undefined, callbacks: RealtimeCallbacks) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const callbacksRef = useRef<RealtimeCallbacks>(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!establishmentId) return;

    let isSubscribed = true;

    // Helper to fetch authoritative state from server
    const syncAuthoritativeState = async () => {
      try {
        const data = await fetchQueue(establishmentId);
        if (isSubscribed && data) {
          callbacksRef.current.onQueueUpdate?.(data.queue || [], data.activeCalledTicket || null);
          callbacksRef.current.onStatusChange?.(true);
        }
      } catch (err) {
        if (isSubscribed) {
          callbacksRef.current.onStatusChange?.(false);
        }
      }
    };

    const streamUrl = `/api/realtime/stream?establishmentId=${encodeURIComponent(establishmentId)}`;
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!isSubscribed) return;
      setIsConnected(true);
      callbacksRef.current.onStatusChange?.(true);
      // Immediately pull fresh state to ensure no delta was missed during reconnection
      syncAuthoritativeState();
    };

    es.onerror = () => {
      if (!isSubscribed) return;
      setIsConnected(false);
      callbacksRef.current.onStatusChange?.(false);
    };

    es.addEventListener('initial_snapshot', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.queue !== undefined) {
          callbacksRef.current.onQueueUpdate?.(data.queue, data.activeCalledTicket || null);
        }
        if (data.establishment) {
          callbacksRef.current.onEstablishmentUpdate?.(data.establishment);
        }
      } catch (err) {
        console.error('Error parsing initial_snapshot:', err);
      }
    });

    es.addEventListener('queue_updated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacksRef.current.onQueueUpdate?.(data.queue, data.activeCalledTicket || null);
      } catch (err) {
        console.error('Error parsing queue_updated:', err);
      }
    });

    es.addEventListener('ticket_called', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacksRef.current.onTicketCalled?.(data.calledTicket, data.queue);
      } catch (err) {
        console.error('Error parsing ticket_called:', err);
      }
    });

    es.addEventListener('call_dismissed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacksRef.current.onQueueUpdate?.(data.queue, null);
      } catch (err) {
        console.error('Error parsing call_dismissed:', err);
      }
    });

    es.addEventListener('ticket_removed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacksRef.current.onQueueUpdate?.(data.queue, null);
      } catch (err) {
        console.error('Error parsing ticket_removed:', err);
      }
    });

    es.addEventListener('queue_cleared', () => {
      callbacksRef.current.onQueueUpdate?.([], null);
    });

    es.addEventListener('establishment_updated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacksRef.current.onEstablishmentUpdate?.(data);
      } catch (err) {
        console.error('Error parsing establishment_updated:', err);
      }
    });

    // Reconnection handlers when device recovers network or app regains focus
    const handleOnline = () => {
      syncAuthoritativeState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncAuthoritativeState();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSubscribed = false;
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      es.close();
    };
  }, [establishmentId]);

  return { isConnected };
}
