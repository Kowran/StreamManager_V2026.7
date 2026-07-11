import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { X } from 'lucide-react';

interface FlyingBalloonConfig {
  id: string;
  name: string;
  image_url: string;
  link_url: string | null;
  link_target: string;
  effect: 'floating' | 'static' | 'blinking' | 'bouncing' | 'pulsing';
  size: number;
  position_bottom: number;
  position_right: number;
}

interface FlyingBalloonProps {
  /** Extra offset from the bottom to stack above the expiring-items balloon */
  bottomOffset?: number;
}

export function FlyingBalloon({ bottomOffset = 0 }: FlyingBalloonProps) {
  const { user } = useAuth();
  const [balloon, setBalloon] = useState<FlyingBalloonConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadBalloon();
  }, [user]);

  async function loadBalloon() {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('flying_balloons')
        .select('id, name, image_url, link_url, link_target, effect, size, position_bottom, position_right')
        .eq('is_active', true)
        .lte('start_date', now)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading flying balloon:', error);
        return;
      }
      setBalloon(data);
    } catch (err) {
      console.error('Error loading flying balloon:', err);
    }
  }

  if (!balloon || dismissed) return null;

  const effectClass = {
    floating: 'animate-float',
    static: '',
    blinking: 'animate-blink',
    bouncing: 'animate-whatsapp-bounce',
    pulsing: 'animate-whatsapp-pulse',
  }[balloon.effect] || '';

  const finalBottom = balloon.position_bottom + bottomOffset;

  const content = (
    <img
      src={balloon.image_url}
      alt={balloon.name}
      className="w-full h-full object-contain pointer-events-none select-none"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
      draggable={false}
    />
  );

  const wrapperStyle: React.CSSProperties = {
    width: `${balloon.size}px`,
    height: `${balloon.size}px`,
    bottom: `${finalBottom}px`,
    right: `${balloon.position_right}px`,
  };

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
  };

  if (balloon.link_url) {
    return (
      <a
        href={balloon.link_url}
        target={balloon.link_target === '_blank' ? '_blank' : '_self'}
        rel="noopener noreferrer"
        className={`fixed z-40 flex items-center justify-center cursor-pointer transition-transform hover:scale-110 ${effectClass}`}
        style={wrapperStyle}
      >
        {content}
        <button
          onClick={dismiss}
          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md z-10"
          aria-label="Fechar balão"
        >
          <X className="w-3 h-3" />
        </button>
      </a>
    );
  }

  return (
    <div
      className={`fixed z-40 flex items-center justify-center ${effectClass}`}
      style={wrapperStyle}
    >
      {content}
      <button
        onClick={dismiss}
        className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md z-10"
        aria-label="Fechar balão"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
