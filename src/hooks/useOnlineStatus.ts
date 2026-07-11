import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const ONLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

export function useOnlineHeartbeat(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    async function ping() {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId!);
    }

    ping();
    intervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);
}

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD;
}

export function getOnlineLabel(lastSeenAt: string | null | undefined, language = 'pt'): string {
  if (!lastSeenAt) return language === 'pt' ? 'Nunca visto' : 'Never seen';

  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_THRESHOLD) return language === 'pt' ? 'Online agora' : 'Online now';

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) {
    return language === 'pt' ? `Visto há ${minutes}m` : `Seen ${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return language === 'pt' ? `Visto há ${hours}h` : `Seen ${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return language === 'pt' ? `Visto há ${days}d` : `Seen ${days}d ago`;
  }
  return language === 'pt'
    ? `Visto em ${new Date(lastSeenAt).toLocaleDateString('pt-BR')}`
    : `Seen on ${new Date(lastSeenAt).toLocaleDateString('en-US')}`;
}
