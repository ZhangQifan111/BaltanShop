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
        viewBox="0 0 240 360"
        fill="currentColor"
      >
        {/* 头部 + 一体化 V 形角（头顶两个尖角，中间 V 凹陷） */}
        <path d="M 55 65
                 L 75 25
                 L 120 55
                 L 165 25
                 L 185 65
                 Q 188 95 170 102
                 L 70 102
                 Q 52 95 55 65 Z" />

        {/* 大圆眼睛 */}
        <circle cx="100" cy="78" r="8" fill="#0f1117" />
        <circle cx="140" cy="78" r="8" fill="#0f1117" />

        {/* 颈部 */}
        <rect x="112" y="102" width="16" height="10" />

        {/* 肩膀（较宽） */}
        <path d="M 55 120 Q 55 112 75 112 L 165 112 Q 185 112 185 120 L 175 140 L 65 140 Z" />

        {/* 躯干（上宽下窄的肌肉型） */}
        <path d="M 65 140 L 175 140 L 165 220 L 75 220 Z" />

        {/* 躯干节段线（甲虫壳质感） */}
        <line x1="80" y1="165" x2="160" y2="165" stroke="#0f1117" strokeWidth="1.5" />
        <line x1="78" y1="190" x2="162" y2="190" stroke="#0f1117" strokeWidth="1.5" />

        {/* 左臂（粗曲线） */}
        <path d="M 60 135 Q 35 158 22 200"
          stroke="currentColor" strokeWidth="12" fill="none" strokeLinecap="round" />

        {/* 右臂（镜像） */}
        <path d="M 180 135 Q 205 158 218 200"
          stroke="currentColor" strokeWidth="12" fill="none" strokeLinecap="round" />

        {/* 左蟹钳 - 张开（上下两颚 + 中间缝） */}
        <ellipse cx="26" cy="220" rx="6" ry="20" />
        <path d="M 24 200
                 C 10 188, -2 202, 6 218
                 C 12 226, 24 222, 26 212 Z" />
        <path d="M 24 222
                 C 10 224, -2 242, 6 256
                 C 12 262, 24 256, 26 244 Z" />

        {/* 右蟹钳 - 张开（镜像） */}
        <ellipse cx="214" cy="220" rx="6" ry="20" />
        <path d="M 216 200
                 C 230 188, 242 202, 234 218
                 C 228 226, 216 222, 214 212 Z" />
        <path d="M 216 222
                 C 230 224, 242 242, 234 256
                 C 228 262, 216 256, 214 244 Z" />

        {/* 裙甲（髋部梯形装甲，带横纹） */}
        <path d="M 70 220 L 170 220 L 160 258 L 80 258 Z" />
        <line x1="82" y1="235" x2="158" y2="235" stroke="#0f1117" strokeWidth="1.5" />
        <line x1="80" y1="248" x2="160" y2="248" stroke="#0f1117" strokeWidth="1.5" />

        {/* 左腿 */}
        <path d="M 90 258 L 110 258 L 108 320 L 92 320 Z" />
        {/* 右腿 */}
        <path d="M 130 258 L 150 258 L 148 320 L 132 320 Z" />

        {/* 脚 */}
        <ellipse cx="100" cy="326" rx="14" ry="5" />
        <ellipse cx="140" cy="326" rx="14" ry="5" />
      </svg>
    </div>
  );
}
