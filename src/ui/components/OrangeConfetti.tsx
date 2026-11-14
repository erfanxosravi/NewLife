import { motion } from 'motion/react';

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  color: string;
  shape: 'rect' | 'dot' | 'diamond';
  delay: number;
}

const COLORS = [
  'var(--primary)',
  'var(--primary-strong)',
  'var(--stat-happiness)',
  'var(--primary-soft)',
];

const PARTICLES: Particle[] = Array.from({ length: 24 }, (_, idx) => {
  const angle = (idx / 24) * Math.PI * 2 + (idx % 3) * 0.14;
  const dist = 76 + (idx % 4) * 28;
  return {
    id: idx,
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist - 18,
    rotate: ((idx * 47) % 360) - 180,
    scale: 0.75 + (idx % 3) * 0.25,
    color: COLORS[idx % COLORS.length],
    shape: idx % 3 === 0 ? 'diamond' : idx % 2 === 0 ? 'rect' : 'dot',
    delay: (idx % 5) * 0.025,
  };
});

export function OrangeConfetti() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      {PARTICLES.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.3, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: p.x,
            y: [0, p.y, p.y + 34],
            scale: [0.3, p.scale, p.scale * 0.85],
            rotate: p.rotate,
          }}
          transition={{
            duration: 1.05,
            delay: p.delay,
            ease: [0.18, 0.88, 0.32, 1],
          }}
          style={{ backgroundColor: p.color }}
          className={
            p.shape === 'dot'
              ? 'absolute h-2.5 w-2.5 rounded-full'
              : p.shape === 'diamond'
                ? 'absolute h-2.5 w-2.5 rotate-45 rounded-[2px]'
                : 'absolute h-3 w-1.5 rounded-xs'
          }
        />
      ))}
    </div>
  );
}
