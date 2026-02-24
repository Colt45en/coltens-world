import React, { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let _gsapRegistered = false;
function ensureGsap() {
  if (typeof window === "undefined") return;
  if (_gsapRegistered) return;
  gsap.registerPlugin(ScrollTrigger);
  _gsapRegistered = true;
}

export type AnimatedDirection = "vertical" | "horizontal";

export type AnimatedContentProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  distance?: number;
  direction?: AnimatedDirection;
  reverse?: boolean;
  duration?: number;
  ease?: string;
  initialOpacity?: number;
  animateOpacity?: boolean;
  scale?: number;
  threshold?: number;
  delay?: number;
  once?: boolean;
  markers?: boolean;
  onComplete?: () => void;
};

export default function AnimatedContent({
  children,
  className,
  style,
  distance = 100,
  direction = "vertical",
  reverse = false,
  duration = 0.8,
  ease = "power3.out",
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  once = true,
  markers = false,
  onComplete,
}: AnimatedContentProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    ensureGsap();
    const el = ref.current;
    if (!el) return;

    const t = Math.max(0, Math.min(1, threshold));
    const startPct = Math.round((1 - t) * 100);
    const axis = direction === "vertical" ? "y" : "x";
    const sign = reverse ? -1 : 1;

    const fromVars: gsap.TweenVars = {
      [axis]: sign * distance,
      scale,
    };

    if (animateOpacity) fromVars.opacity = initialOpacity;

    const toVars: gsap.TweenVars = {
      [axis]: 0,
      scale: 1,
      duration,
      ease,
      delay,
      clearProps: "transform,opacity",
      scrollTrigger: {
        trigger: el,
        start: `top ${startPct}%`,
        toggleActions: once ? "play none none none" : "play none none reverse",
        once,
        markers,
      },
    };
    if (onComplete) toVars.onComplete = onComplete;

    const ctx = gsap.context(() => {
      gsap.fromTo(el, fromVars, toVars);
    }, el);

    return () => {
      ctx.revert();
    };
  }, [
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    threshold,
    delay,
    once,
    markers,
    onComplete,
  ]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

export { AnimatedContent };
