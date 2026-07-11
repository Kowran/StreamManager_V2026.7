import React, { useMemo } from 'react';

interface Snowflake {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
}

const generateSnowflakes = (count: number): Snowflake[] => {
  const flakes: Snowflake[] = [];
  for (let i = 0; i < count; i++) {
    flakes.push({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 8 + Math.random() * 8,
      size: 4 + Math.random() * 6,
      opacity: 0.3 + Math.random() * 0.7,
    });
  }
  return flakes;
};

export const SnowfallEffect: React.FC = () => {
  const snowflakes = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    return generateSnowflakes(isMobile ? 30 : 60);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes snowfall {
          from {
            transform: translateY(-10vh) translateX(0);
            opacity: 1;
          }
          to {
            transform: translateY(100vh) translateX(100px);
            opacity: 0.3;
          }
        }

        @keyframes snowsway {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(30px);
          }
        }

        @keyframes snowrotate {
          from {
            transform: rotateZ(0deg);
          }
          to {
            transform: rotateZ(360deg);
          }
        }

        .snowflake {
          position: absolute;
          top: -10vh;
          pointer-events: none;
          will-change: transform;
        }

        .snowflake::before {
          content: '❄';
          display: block;
          position: absolute;
          animation: snowrotate linear infinite;
        }
      `}</style>

      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake"
          style={{
            left: `${flake.left}%`,
            fontSize: `${flake.size}px`,
            opacity: flake.opacity,
            animation: `snowfall ${flake.duration}s linear ${flake.delay}s infinite`,
            animationDelay: `${flake.delay}s`,
            color: 'rgba(255, 255, 255, 0.9)',
            textShadow: '0 0 5px rgba(200, 220, 255, 0.5)',
          }}
        >
          ❄
        </div>
      ))}
    </div>
  );
};
