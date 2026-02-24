import React, { useEffect, useMemo, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  r: number;
  c: string;
  vx: number;
  vy: number;
}

export function NeonPhysicsCanvas(props: Readonly<{ particleCount?: number }>) {
  const particleCount = props.particleCount ?? 60;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const colors = useMemo(() => ["#00f3ff", "#ffaa00", "#00ff66"], []);
  const mouse = useRef({ x: -1000, y: -1000, active: false });

  // Physics constants
  const GRAVITY = 0.15;
  const FLOOR_BOUNCE = -0.7;
  const WALL_BOUNCE = -0.7;
  const MOUSE_REPEL_RADIUS = 150;
  const MOUSE_FORCE = 2;
  const PULSE_FORCE = 15;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const makeParticle = (): Particle => {
      const color = colors[Math.trunc(Math.random() * colors.length) % colors.length];
      return {
        x: Math.random() * w,
        y: Math.random() * h * 0.5,
        r: rand(2, 6),
        c: color ?? "#fff",
        vx: rand(-2, 2),
        vy: rand(-2, 2),
      };
    };

    const particles: Particle[] = Array.from({ length: particleCount }, makeParticle);

    const pulse = (originX: number, originY: number, strength: number) => {
      for (const p of particles) {
        const dx = p.x - originX;
        const dy = p.y - originY;
        const dist = Math.hypot(dx, dy) + 0.1;
        let force = strength * (100 / dist);
        force = Math.min(force, 20);

        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force - 5;
      }
    };

    const update = (p: Particle) => {
      p.vy += GRAVITY;

      p.x += p.vx;
      p.y += p.vy;

      // floor
      if (p.y + p.r > h) {
        p.y = h - p.r;
        p.vy *= FLOOR_BOUNCE;
        p.vx *= 0.95;
      }
      // ceiling
      if (p.y - p.r < 0) {
        p.y = p.r;
        p.vy *= -0.5;
      }
      // walls
      if (p.x + p.r > w) {
        p.x = w - p.r;
        p.vx *= WALL_BOUNCE;
      } else if (p.x - p.r < 0) {
        p.x = p.r;
        p.vx *= WALL_BOUNCE;
      }

      // mouse repel
      if (mouse.current.active) {
        const dx = p.x - mouse.current.x;
        const dy = p.y - mouse.current.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0 && dist < MOUSE_REPEL_RADIUS) {
          const fx = dx / dist;
          const fy = dy / dist;
          const mag = (MOUSE_REPEL_RADIUS - dist) / MOUSE_REPEL_RADIUS;

          p.vx += fx * mag * MOUSE_FORCE;
          p.vy += fy * mag * MOUSE_FORCE;
        }
      }
    };

    const draw = (p: Particle) => {
      if (!ctx) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.c;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        update(p);
        draw(p);
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    // pointer events
    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      mouse.current.active = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      mouse.current.x = t.clientX;
      mouse.current.y = t.clientY;
      mouse.current.active = true;
    };

    const onPointerLeave = () => {
      mouse.current.active = false;
    };

    const onClick = (e: MouseEvent) => pulse(e.clientX, e.clientY, PULSE_FORCE);

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      pulse(t.clientX, t.clientY, PULSE_FORCE);
    };

    globalThis.addEventListener("mousemove", onMouseMove);
    globalThis.addEventListener("touchmove", onTouchMove, { passive: true });
    globalThis.addEventListener("mouseout", onPointerLeave);
    globalThis.addEventListener("touchend", onPointerLeave);
    globalThis.addEventListener("click", onClick);
    globalThis.addEventListener("touchstart", onTouchStart, { passive: true });

    // stir automation
    intervalRef.current = globalThis.setInterval(() => {
      const rx = Math.random() * w;
      const ry = h - Math.random() * 200;
      pulse(rx, ry, PULSE_FORCE);
    }, 3000) as unknown as number;

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      globalThis.removeEventListener("mousemove", onMouseMove);
      globalThis.removeEventListener("touchmove", onTouchMove as any);
      globalThis.removeEventListener("mouseout", onPointerLeave);
      globalThis.removeEventListener("touchend", onPointerLeave);
      globalThis.removeEventListener("click", onClick);
      globalThis.removeEventListener("touchstart", onTouchStart as any);

      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [colors, particleCount]);

  return (
    <canvas ref={canvasRef} className="fixed inset-0 -z-20 neon-bg-radial" aria-hidden="true" tabIndex={-1} />
  );
}
