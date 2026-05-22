import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const eventSourceRef = useRef(null);

  const connect = useCallback(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventsUrl = `${window.location.origin}/events`;

    try {
      const es = new EventSource(eventsUrl);

      es.onopen = () => {
        setConnected(true);
        console.log('SSE connected');
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (e) {
          console.error('Failed to parse SSE message:', e);
        }
      };

      es.onerror = () => {
        console.log('SSE connection error — will reconnect in 3s');
        setConnected(false);
        es.close();
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      eventSourceRef.current = es;
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setConnected(false);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [onMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return { connected };
}
