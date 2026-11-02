import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeSse() {
  const queryClient = useQueryClient();
  const [lastUpdatedId, setLastUpdatedId] = useState<number | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      timer = setTimeout(() => {
        es = new EventSource('/api/public/stream');

        const handleWoUpdated = (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload?.id) setLastUpdatedId(Number(payload.id));
          } catch {
            // ignore
          }
          queryClient.invalidateQueries({ queryKey: ['work-orders'] });
          queryClient.invalidateQueries({ queryKey: ['work-order'] });
          queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
          queryClient.invalidateQueries({ queryKey: ['waiting-room'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['parts'] });
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
        };

        const handleNotification = () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        };

        es.addEventListener('wo.updated', handleWoUpdated);
        es.addEventListener('notification', handleNotification);
      }, 1000);
    };

    if (document.readyState === 'complete') {
      connect();
    } else {
      window.addEventListener('load', connect, { once: true });
    }

    return () => {
      window.removeEventListener('load', connect);
      if (timer) clearTimeout(timer);
      if (es) es.close();
    };
  }, [queryClient]);

  return { lastUpdatedId };
}

