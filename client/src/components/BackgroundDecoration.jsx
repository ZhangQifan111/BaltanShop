import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const DEFAULT_LEFT = '/uploads/monster/alienbaltan/alienbaltan-01-toy.png';
const DEFAULT_RIGHT = '/uploads/monster/ultraman/ultraman-01-toy.png';

function makeStars(count, seed = 1337) {
  const stars = [];
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < count; i++) {
    stars.push({
      cx: rand() * 1000,
      cy: rand() * 1000,
      r: 0.3 + rand() * 1.2,
      o: 0.25 + rand() * 0.6,
    });
  }
  return stars;
}

export default function BackgroundDecoration() {
  const stars = makeStars(90);
  const [bgLeft, setBgLeft] = useState(null);
  const [bgRight, setBgRight] = useState(null);

  useEffect(() => {
    api.get('/settings').then(s => {
      setBgLeft(s.bg_left_url || null);
      setBgRight(s.bg_right_url || null);
    }).catch(() => {});
  }, []);

  const leftSrc = bgLeft || DEFAULT_LEFT;
  const rightSrc = bgRight || DEFAULT_RIGHT;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      <img
        src={leftSrc}
        alt=""
        className="hidden md:block absolute left-0 top-[45%] -translate-y-1/2 w-[420px] h-auto opacity-100 pointer-events-none"
        style={{
          WebkitMaskImage: `url(${leftSrc})`,
          maskImage: `url(${leftSrc})`,
          WebkitMaskMode: 'luminance',
          maskMode: 'luminance',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
        loading="lazy"
        decoding="async"
      />

      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#ffffff"
            opacity={s.o}
          />
        ))}
      </svg>

      <img
        src={rightSrc}
        alt=""
        className="hidden md:block absolute right-0 top-[45%] -translate-y-1/2 w-[420px] h-auto opacity-100 -scale-x-100 pointer-events-none"
        style={{
          WebkitMaskImage: `url(${rightSrc})`,
          maskImage: `url(${rightSrc})`,
          WebkitMaskMode: 'luminance',
          maskMode: 'luminance',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
