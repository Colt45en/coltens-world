import React, { useEffect, useMemo, useRef } from "react";
import "./Galaxy.css";
import { Mesh, Program, Renderer, Triangle, Vec2 } from "ogl";

export type GalaxyProps = {
  className?: string;
  style?: React.CSSProperties;
  transparent?: boolean;
  mouseInteraction?: boolean;
  glowIntensity?: number;
  rotationSpeed?: number;
  density?: number;
  hueShift?: number;
  disableAnimation?: boolean;
  fragmentShader?: string;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

const vertexShader = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const defaultFragmentShader = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;
uniform float uGlow;
uniform float uRotation;
uniform float uDensity;
uniform float uHueShift;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a, b, u.x) +
         (c - a) * u.y * (1.0 - u.x) +
         (d - b) * u.x * u.y;
}

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for(int i=0;i<5;i++){
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 hsv2rgb(vec3 c){
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main(){
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / max(1.0, uResolution.y), 1.0);
  vec2 p = (uv - 0.5) * aspect;
  vec2 m = (uMouse - 0.5) * aspect;
  p -= m * 0.15;

  float t = uTime * uRotation;
  float ct = cos(t), st = sin(t);
  mat2 R = mat2(ct, -st, st, ct);
  p = R * p;

  float r = length(p);
  float d = fbm(p * (2.5 + uDensity * 2.0) + t * 0.05);
  float arms = fbm(vec2(atan(p.y, p.x) * 2.0, r * 3.0) + t * 0.08);
  float nebula = smoothstep(0.15, 1.0, d) * (1.0 - smoothstep(0.55, 1.35, r));
  nebula *= 0.65 + 0.6 * arms;

  float starField = pow(noise(p * (18.0 + uDensity * 22.0) + t * 0.02), 14.0);
  starField *= smoothstep(1.6, 0.2, r);

  float core = exp(-r * (6.0 + uGlow * 6.0));
  core = clamp(core, 0.0, 1.0);

  float hue = 0.58 + uHueShift + 0.12 * arms;
  vec3 nebColor = hsv2rgb(vec3(hue, 0.75, 1.0));
  vec3 starColor = vec3(1.0);

  vec3 col = vec3(0.0);
  col += nebColor * nebula * 1.15;
  col += starColor * starField * 1.4;
  col += hsv2rgb(vec3(hue + 0.05, 0.35, 1.0)) * core * (1.0 + uGlow);

  float vig = smoothstep(1.2, 0.2, r);
  col *= vig;

  float alpha = clamp(nebula + starField + core, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

export default function Galaxy({
  className,
  style,
  transparent = true,
  mouseInteraction = true,
  glowIntensity = 0.5,
  rotationSpeed = 0.25,
  density = 0.6,
  hueShift = 0.0,
  disableAnimation = false,
  fragmentShader,
}: GalaxyProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frag = useMemo(() => fragmentShader ?? defaultFragmentShader, [fragmentShader]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const renderer = new Renderer({ canvas, alpha: transparent, dpr });
    const gl = renderer.gl;

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new Vec2(0.5, 0.5) },
      uResolution: { value: new Vec2(1, 1) },
      uGlow: { value: clamp(glowIntensity, 0, 2) },
      uRotation: { value: clamp(rotationSpeed, 0, 4) },
      uDensity: { value: clamp(density, 0, 2) },
      uHueShift: { value: hueShift },
    };

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: frag,
      uniforms,
      transparent,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new Mesh(gl, { geometry, program });

    let raf = 0;
    let alive = true;
    let mouseTarget = { x: 0.5, y: 0.5 };
    let mouseSmooth = { x: 0.5, y: 0.5 };

    const onMove = (e: PointerEvent) => {
      if (!mouseInteraction) return;
      const r = wrap.getBoundingClientRect();
      const nx = (e.clientX - r.left) / Math.max(1, r.width);
      const ny = (e.clientY - r.top) / Math.max(1, r.height);
      mouseTarget = { x: clamp(nx, 0, 1), y: clamp(1 - ny, 0, 1) };
    };

    const onLeave = () => {
      mouseTarget = { x: 0.5, y: 0.5 };
    };

    wrap.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerleave", onLeave, { passive: true });

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      renderer.setSize(r.width, r.height);
      uniforms.uResolution.value.set(r.width * dpr, r.height * dpr);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const start = performance.now();
    const tick = (now: number) => {
      if (!alive) return;
      const t = (now - start) / 1000;
      if (!disableAnimation) uniforms.uTime.value = t;

      const a = 0.08;
      mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * a;
      mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * a;
      uniforms.uMouse.value.set(mouseSmooth.x, mouseSmooth.y);

      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      try {
        const ext = gl.getExtension("WEBGL_lose_context");
        ext?.loseContext();
      } catch {
        // ignore
      }
    };
  }, [frag, transparent, mouseInteraction, glowIntensity, rotationSpeed, density, hueShift, disableAnimation]);

  return (
    <div ref={wrapRef} className={["we-galaxy", className].filter(Boolean).join(" ")} style={style}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export { Galaxy };
