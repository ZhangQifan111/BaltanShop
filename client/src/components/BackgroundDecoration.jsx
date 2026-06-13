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
      {/* 巴尔坦星人 - 实物图（已裁掉文字条），左侧偏下居中。
          mask-image: luminance 把图本身的亮度当 alpha——亮处（玩具）保留，
          暗处（黑底）变透明，不再覆盖背后内容。 */}
      <img
        src="/uploads/monster/alienbaltan/alienbaltan-01-toy.png"
        alt=""
        className="hidden md:block absolute left-0 top-[45%] -translate-y-1/2 w-[420px] h-auto opacity-100 pointer-events-none"
        style={{
          WebkitMaskImage: 'url(/uploads/monster/alienbaltan/alienbaltan-01-toy.png)',
          maskImage: 'url(/uploads/monster/alienbaltan/alienbaltan-01-toy.png)',
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

      {/* 奥特曼 - 实物图（已裁掉文字条），右侧偏下居中。
          同样 luminance mask + 镜像。 */}
      <img
        src="/uploads/monster/ultraman/ultraman-01-toy.png"
        alt=""
        className="hidden md:block absolute right-0 top-[45%] -translate-y-1/2 w-[420px] h-auto opacity-100 -scale-x-100 pointer-events-none"
        style={{
          WebkitMaskImage: 'url(/uploads/monster/ultraman/ultraman-01-toy.png)',
          maskImage: 'url(/uploads/monster/ultraman/ultraman-01-toy.png)',
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
