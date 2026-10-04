import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboardSummaryApi } from '../api/dashboard';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export function useAlertStream() {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // 1. Dashboard summary query with 10-second polling fallback
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummaryApi,
    enabled: isAuthenticated,
    refetchInterval: 10000,
    staleTime: 4000,
  });

  // 2. Server-Sent Events live stream listener
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;

    const connectStream = () => {
      // Build stream URL with token query parameter
      const streamUrl = `${API_BASE_URL}/alerts/stream?token=${encodeURIComponent(token)}`;
      eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        // Connected to SSE stream
      };

      eventSource.onmessage = (event) => {
        try {
          if (!event.data || event.data.trim() === '') return;
          JSON.parse(event.data);
          
          // Invalidate React Query caches immediately on any alert event
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
          queryClient.invalidateQueries({ queryKey: ['alerts'] });
          queryClient.invalidateQueries({ queryKey: ['equipment'] });
          queryClient.invalidateQueries({ queryKey: ['equipment-readings'] });
        } catch (err) {
          // Heartbeats (: heartbeat) or non-JSON payloads
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Attempt reconnection after 5 seconds
        reconnectTimer = setTimeout(connectStream, 5000);
      };
    };

    connectStream();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [token, isAuthenticated, queryClient]);

  const activeAlertsCount = summaryQuery.data?.summary?.activeAlerts ?? 0;

  return {
    ...summaryQuery,
    activeAlertsCount,
  };
}
