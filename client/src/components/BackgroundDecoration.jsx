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

      {/* 巴尔坦星人 (Baltan character) - 左下角，跟右上胶囊对角呼应 */}
      <svg
        className="absolute bottom-24 left-6 text-accent opacity-[0.2] hidden md:block"
        style={{ width: '15rem', height: '21rem' }}
        viewBox="0 0 200 280"
        fill="currentColor"
      >
        {/* 触角（带圆头） */}
        <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none">
          <line x1="86" y1="14" x2="92" y2="58" />
          <line x1="114" y1="14" x2="108" y2="58" />
        </g>
        <circle cx="86" cy="12" r="3" />
        <circle cx="114" cy="12" r="3" />

        {/* 头部（甲壳形，扁宽下收） */}
        <path d="M 60 65 Q 60 50 78 47 L 122 47 Q 140 50 140 65 L 138 95 Q 130 103 100 103 Q 70 103 62 95 Z" />

        {/* 身体（竖椭圆） */}
        <ellipse cx="100" cy="175" rx="33" ry="78" />

        {/* 眼睛（黑点） */}
        <circle cx="84" cy="73" r="4" fill="#0f1117" />
        <circle cx="116" cy="73" r="4" fill="#0f1117" />

        {/* 左钳 */}
        <path d="M 68 125 Q 28 105 8 140 Q 0 175 26 195 Q 50 200 72 175 Q 76 150 68 125 Z" />
        {/* 右钳（镜像） */}
        <path d="M 132 125 Q 172 105 192 140 Q 200 175 174 195 Q 150 200 128 175 Q 124 150 132 125 Z" />

        {/* 钳子分叉（两条腿的沟槽） */}
        <path d="M 16 150 L 44 192" stroke="#0f1117" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M 184 150 L 156 192" stroke="#0f1117" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}
