import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useCommunityUnreadCount(userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    loadUnreadCount();

    const channel = supabase
      .channel(`community_unread:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_posts'
        },
        () => {
          loadUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_post_reads',
          filter: `user_id=eq.${userId}`
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function loadUnreadCount() {
    if (!userId) return;

    try {
      const { data: posts } = await supabase
        .from('community_posts')
        .select('id');

      if (!posts || posts.length === 0) {
        setUnreadCount(0);
        return;
      }

      const { data: reads } = await supabase
        .from('community_post_reads')
        .select('post_id')
        .eq('user_id', userId);

      const readPostIds = new Set(reads?.map(r => r.post_id) || []);
      const unreadPostsCount = posts.filter(p => !readPostIds.has(p.id)).length;

      setUnreadCount(unreadPostsCount);
    } catch (error) {
      console.error('Error loading unread count:', error);
      setUnreadCount(0);
    }
  }

  return unreadCount;
}
