import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface CategoryData {
  name: string;
  marketCount: number;
  volume: number;
  color: string;
  angle: number;
}

interface CommanderRadarProps {
  categories?: CategoryData[];
  className?: string;
}

const DEFAULT_CATEGORIES: CategoryData[] = [
  { name: 'Tech', marketCount: 8, volume: 125000, color: '#06b6d4', angle: 0 },
  { name: 'Weather', marketCount: 5, volume: 89000, color: '#10b981', angle: 60 },
  { name: 'Logistics', marketCount: 12, volume: 234000, color: '#f59e0b', angle: 120 },
  { name: 'Cloud', marketCount: 6, volume: 156000, color: '#8b5cf6', angle: 180 },
  { name: 'Crypto', marketCount: 15, volume: 456000, color: '#ef4444', angle: 240 },
  { name: 'Aerospace', marketCount: 3, volume: 45000, color: '#ec4899', angle: 300 },
];

export default function CommanderRadar({ 
  categories = DEFAULT_CATEGORIES,
  className 
}: CommanderRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCategory, setHoveredCategory] = useState<CategoryData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  const sweepAngleRef = useRef(0);

  // Find max values for normalization
  const maxMarkets = Math.max(...categories.map(c => c.marketCount));
  const maxVolume = Math.max(...categories.map(c => c.volume));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY) - 40;

    const animate = () => {
      // Clear
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid circles
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const r = (maxRadius / 4) * i;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw grid lines
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX + Math.cos(angle) * maxRadius,
          centerY + Math.sin(angle) * maxRadius
        );
        ctx.stroke();
      }

      // Draw sweep line
      sweepAngleRef.current = (sweepAngleRef.current + 0.02) % (Math.PI * 2);
      const sweepGradient = ctx.createLinearGradient(
        centerX,
        centerY,
        centerX + Math.cos(sweepAngleRef.current - Math.PI / 2) * maxRadius,
        centerY + Math.sin(sweepAngleRef.current - Math.PI / 2) * maxRadius
      );
      sweepGradient.addColorStop(0, 'rgba(6, 182, 212, 0.5)');
      sweepGradient.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.strokeStyle = sweepGradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(sweepAngleRef.current - Math.PI / 2) * maxRadius,
        centerY + Math.sin(sweepAngleRef.current - Math.PI / 2) * maxRadius
      );
      ctx.stroke();

      // Draw sweep trail
      ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(
        centerX,
        centerY,
        maxRadius,
        sweepAngleRef.current - Math.PI / 2 - 0.5,
        sweepAngleRef.current - Math.PI / 2
      );
      ctx.fill();

      // Draw category blips
      categories.forEach((category) => {
        const angle = (category.angle * Math.PI) / 180 - Math.PI / 2;
        const radius = (category.volume / maxVolume) * maxRadius * 0.8 + maxRadius * 0.2;

        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        // Blip glow
        const glowSize = 10 + (category.marketCount / maxMarkets) * 15;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize * 2);
        gradient.addColorStop(0, category.color + '60');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, glowSize * 2, 0, Math.PI * 2);
        ctx.fill();

        // Blip core
        const coreSize = 4 + (category.marketCount / maxMarkets) * 8;
        ctx.fillStyle = category.color;
        ctx.beginPath();
        ctx.arc(x, y, coreSize, 0, Math.PI * 2);
        ctx.fill();

        // Pulse animation
        const pulsePhase = (Date.now() / 1000 + category.angle / 60) % 1;
        ctx.strokeStyle = category.color + Math.floor((1 - pulsePhase) * 80).toString(16).padStart(2, '0');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, coreSize + pulsePhase * 15, 0, Math.PI * 2);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(category.name, x, y + coreSize + 16);
      });

      // Center dot
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [categories, maxMarkets, maxVolume]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY) - 40;

    // Check if hovering over a category
    let found: CategoryData | null = null;
    for (const category of categories) {
      const angle = (category.angle * Math.PI) / 180 - Math.PI / 2;
      const radius = (category.volume / maxVolume) * maxRadius * 0.8 + maxRadius * 0.2;
      const cx = centerX + Math.cos(angle) * radius;
      const cy = centerY + Math.sin(angle) * radius;

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < 20) {
        found = category;
        break;
      }
    }
    setHoveredCategory(found);
  };

  return (
    <div className={clsx('relative', className)}>
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredCategory(null)}
        className="rounded-xl border border-slate-700"
      />

      {/* Tooltip */}
      {hoveredCategory && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl pointer-events-none"
          style={{
            left: mousePos.x + 10,
            top: mousePos.y + 10,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: hoveredCategory.color }}
            />
            <span className="font-semibold text-white">{hoveredCategory.name}</span>
          </div>
          <div className="text-sm text-slate-400 space-y-1">
            <div className="flex justify-between gap-4">
              <span>Markets:</span>
              <span className="text-white font-mono">{hoveredCategory.marketCount}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Volume:</span>
              <span className="text-white font-mono">
                ${(hoveredCategory.volume / 1000).toFixed(0)}K
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur rounded-lg p-3">
        <div className="text-xs text-slate-400 mb-2">Market Density</div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-xs text-slate-500">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-cyan-400" />
            <span className="text-xs text-slate-500">High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
