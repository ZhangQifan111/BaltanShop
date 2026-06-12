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
        className="absolute bottom-12 left-6 text-accent opacity-[0.22] hidden md:block"
        style={{ width: '15rem', height: '20rem' }}
        viewBox="0 0 240 320"
        fill="currentColor"
      >
        {/* 头顶 V 形尖角冠 */}
        <path d="M 108 0 L 120 20 L 132 0 L 132 30 L 108 30 Z" />

        {/* 头部（甲壳形） */}
        <path d="M 85 38 L 155 38 L 160 58 Q 164 80 152 90 L 88 90 Q 76 80 80 58 Z" />

        {/* 大圆眼睛 */}
        <circle cx="103" cy="64" r="7" fill="#0f1117" />
        <circle cx="137" cy="64" r="7" fill="#0f1117" />

        {/* 颈部 */}
        <rect x="113" y="90" width="14" height="8" />

        {/* 肩膀（较宽） */}
        <path d="M 62 104 Q 62 96 80 96 L 160 96 Q 178 96 178 104 L 170 124 L 70 124 Z" />

        {/* 躯干（上宽下窄的肌肉型） */}
        <path d="M 70 124 L 170 124 L 162 212 L 78 212 Z" />

        {/* 躯干节段线（甲虫壳质感） */}
        <line x1="85" y1="148" x2="155" y2="148" stroke="#0f1117" strokeWidth="1.5" />
        <line x1="82" y1="172" x2="158" y2="172" stroke="#0f1117" strokeWidth="1.5" />
        <line x1="80" y1="196" x2="160" y2="196" stroke="#0f1117" strokeWidth="1.5" />

        {/* 左臂（粗曲线） */}
        <path d="M 66 120 Q 38 145 22 190"
          stroke="currentColor" strokeWidth="12" fill="none" strokeLinecap="round" />

        {/* 右臂（镜像） */}
        <path d="M 174 120 Q 202 145 218 190"
          stroke="currentColor" strokeWidth="12" fill="none" strokeLinecap="round" />

        {/* 左蟹钳（C 形，分上下颚） */}
        <path d="M 22 185
                 C 6 178, -2 195, 4 210
                 C 10 224, 26 226, 36 214
                 C 42 207, 42 200, 38 196
                 L 28 196
                 C 31 203, 23 206, 16 200
                 C 10 195, 14 182, 22 178 Z" />

        {/* 右蟹钳（镜像） */}
        <path d="M 218 185
                 C 234 178, 242 195, 236 210
                 C 230 224, 214 226, 204 214
                 C 198 207, 198 200, 202 196
                 L 212 196
                 C 209 203, 217 206, 224 200
                 C 230 195, 226 182, 218 178 Z" />

        {/* 髋部（轻微收窄） */}
        <path d="M 78 212 L 162 212 L 156 234 L 84 234 Z" />

        {/* 左腿 */}
        <path d="M 90 234 L 112 234 L 110 304 L 92 304 Z" />
        {/* 右腿 */}
        <path d="M 128 234 L 150 234 L 148 304 L 130 304 Z" />

        {/* 脚 */}
        <ellipse cx="101" cy="310" rx="14" ry="5" />
        <ellipse cx="139" cy="310" rx="14" ry="5" />
      </svg>
    </div>
  );
}
