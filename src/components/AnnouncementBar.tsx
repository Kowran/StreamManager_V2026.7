import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, ExternalLink } from 'lucide-react';

interface Announcement {
  id: string;
  text: string;
  link_url: string | null;
  link_text: string | null;
  bg_color: string;
  text_color: string;
  scroll: boolean;
  blink: boolean;
}

const DISMISS_KEY = 'dismissed_announcements';

export function AnnouncementBar() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDismissed();
    loadAnnouncement();

    const channel = supabase
      .channel('admin_announcements_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_announcements' }, () => {
        loadAnnouncement();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  function loadDismissed() {
    try {
      const stored = sessionStorage.getItem(DISMISS_KEY);
      if (stored) setDismissed(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }

  async function loadAnnouncement() {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('admin_announcements')
        .select('id, text, link_url, link_text, bg_color, text_color, scroll, blink')
        .eq('is_active', true)
        .lte('start_date', now)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('priority', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return;
      if (data && !dismissed.has(data.id)) {
        setAnnouncement(data);
      } else {
        setAnnouncement(null);
      }
    } catch { /* ignore */ }
  }

  function handleDismiss() {
    if (!announcement) return;
    const next = new Set(dismissed);
    next.add(announcement.id);
    setDismissed(next);
    try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
    setAnnouncement(null);
  }

  if (!announcement) return null;

  const { text, link_url, link_text, bg_color, text_color, scroll, blink } = announcement;

  const linkEl = link_url && (
    <a
      href={link_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-bold underline underline-offset-2 hover:opacity-80 transition-opacity whitespace-nowrap"
      style={{ color: text_color }}
    >
      {link_text || link_url}
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
    </a>
  );

  return (
    <div
      className="relative w-full z-40 flex items-center min-h-[40px] px-3 py-2 text-sm font-medium"
      style={{ backgroundColor: bg_color, color: text_color }}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/20 transition-colors flex-shrink-0 z-10"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" style={{ color: text_color }} />
      </button>

      {scroll ? (
        <div className="flex-1 overflow-hidden pr-8">
          <div className="inline-flex items-center gap-3 whitespace-nowrap animate-marquee">
            <span className={blink ? 'animate-blink' : ''}>{text}</span>
            {linkEl}
            <span className="opacity-40">•</span>
            <span className={blink ? 'animate-blink' : ''}>{text}</span>
            {linkEl}
            <span className="opacity-40">•</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center gap-2 pr-8 text-center">
          <span className={blink ? 'animate-blink' : ''}>{text}</span>
          {linkEl}
        </div>
      )}
    </div>
  );
}
