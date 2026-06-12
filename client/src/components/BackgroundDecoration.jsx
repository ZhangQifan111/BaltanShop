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
        style={{ width: '16rem', height: '22rem' }}
        viewBox="0 0 240 320"
        fill="currentColor"
      >
        {/* 触角（分叉向外，带圆头） */}
        <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none">
          <line x1="102" y1="20" x2="95" y2="62" />
          <line x1="138" y1="20" x2="145" y2="62" />
        </g>
        <circle cx="102" cy="18" r="3" />
        <circle cx="138" cy="18" r="3" />

        {/* 头部（甲壳：顶部宽 + 左右两角） */}
        <path d="M 60 75 Q 60 58 78 54 L 162 54 Q 180 58 180 75 L 178 100 Q 170 110 120 110 Q 70 110 62 100 Z" />

        {/* 眼睛（黑点） */}
        <circle cx="98" cy="80" r="5" fill="#0f1117" />
        <circle cx="142" cy="80" r="5" fill="#0f1117" />

        {/* 身体（楔形：上宽下窄） */}
        <path d="M 72 122 L 168 122 L 152 228 Q 120 236 88 228 Z" />

        {/* 左钳（C 形，开口朝向身体，分上下颚） */}
        <path d="M 72 142
                 C 50 128, 18 132, 14 162
                 C 12 196, 42 202, 66 192
                 C 72 187, 76 178, 72 170
                 L 60 170
                 C 64 184, 50 186, 42 178
                 C 32 168, 36 152, 54 146
                 L 72 142 Z" />

        {/* 右钳（镜像） */}
        <path d="M 168 142
                 C 190 128, 222 132, 226 162
                 C 228 196, 198 202, 174 192
                 C 168 187, 164 178, 168 170
                 L 180 170
                 C 176 184, 190 186, 198 178
                 C 208 168, 204 152, 186 146
                 L 168 142 Z" />

        {/* 钳子 V 型分叉（上下颚交汇处的尖牙） */}
        <path d="M 52 160 L 66 170 L 52 180" stroke="#0f1117" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 188 160 L 174 170 L 188 180" stroke="#0f1117" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* 多条细足 */}
        <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none">
          <line x1="92" y1="232" x2="86" y2="290" />
          <line x1="104" y1="236" x2="100" y2="295" />
          <line x1="116" y1="238" x2="114" y2="300" />
          <line x1="124" y1="238" x2="126" y2="300" />
          <line x1="136" y1="236" x2="140" y2="295" />
          <line x1="148" y1="232" x2="154" y2="290" />
        </g>
      </svg>
    </div>
  );
}
