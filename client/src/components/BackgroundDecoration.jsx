// Deterministic pseudo-random so the starfield is identical on every render
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
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Starfield */}
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

      {/* 奥特曼变身胶囊 (Beta Capsule) - 右上 */}
      <svg
        className="absolute -top-16 -right-24 w-80 text-accent opacity-[0.18] hidden md:block"
        style={{ height: '36rem' }}
        viewBox="0 0 100 220"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <rect x="25" y="20" width="50" height="180" rx="25" />
        <line x1="28" y1="45" x2="72" y2="45" />
        <line x1="28" y1="55" x2="72" y2="55" />
        <circle cx="50" cy="80" r="5" fill="currentColor" stroke="none" />
        <line x1="50" y1="110" x2="50" y2="140" />
      </svg>

      {/* 巴尔坦钳子 (Baltan claws) - 底部中央偏上，避开底栏 */}
      <svg
        className="absolute bottom-28 left-1/2 -translate-x-1/2 w-96 h-28 text-accent opacity-[0.18] hidden md:block"
        viewBox="0 0 200 60"
        fill="currentColor"
      >
        {/* 左钳 */}
        <path d="M 8 38 Q 28 6 70 16 Q 90 24 84 40 Q 78 54 30 52 Q 8 48 8 38 Z" />
        {/* 右钳（镜像） */}
        <path d="M 192 38 Q 172 6 130 16 Q 110 24 116 40 Q 122 54 170 52 Q 192 48 192 38 Z" />
        {/* 中间身体 */}
        <ellipse cx="100" cy="36" rx="11" ry="16" />
        {/* 眼睛（掏空） */}
        <circle cx="95" cy="32" r="2" fill="#0f1117" />
        <circle cx="105" cy="32" r="2" fill="#0f1117" />
      </svg>
    </div>
  );
}
