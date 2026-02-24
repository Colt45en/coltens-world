import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RollingFrameBench } from "./bench";
import { useAvatarStore } from "../state/useAvatarStore";

type Tier = 0 | 1 | 2 | 3 | 4;

type RuntimeQualitySetter = (q: {
  aoEnabled?: boolean;
  smaaEnabled?: boolean;
  bloomScale?: number;
  shadowsEnabled?: boolean;
  shadowMapSize?: 1024 | 2048;
}) => void;

function toTier(value: number): Tier {
  const clamped = Math.max(0, Math.min(4, Math.round(value)));
  return clamped as Tier;
}

function applyTier(tier: Tier, setRuntimeQuality: RuntimeQualitySetter): void {
  if (tier === 0) {
    setRuntimeQuality({ aoEnabled: true, bloomScale: 1, shadowsEnabled: true, shadowMapSize: 2048, smaaEnabled: true });
  } else if (tier === 1) {
    setRuntimeQuality({ aoEnabled: false, bloomScale: 1, shadowsEnabled: true, shadowMapSize: 2048, smaaEnabled: true });
  } else if (tier === 2) {
    setRuntimeQuality({ aoEnabled: false, bloomScale: 0.6, shadowsEnabled: true, shadowMapSize: 1024, smaaEnabled: true });
  } else if (tier === 3) {
    setRuntimeQuality({ aoEnabled: false, bloomScale: 0.45, shadowsEnabled: false, shadowMapSize: 1024, smaaEnabled: true });
  } else {
    setRuntimeQuality({ aoEnabled: false, bloomScale: 0.35, shadowsEnabled: false, shadowMapSize: 1024, smaaEnabled: false });
  }
}

export default function AutoQualityScaler() {
  const renderer = useThree((state) => state.gl);
  const bench = useMemo(() => new RollingFrameBench(240), []);
  const setRuntimeQuality = useAvatarStore((state) => state.setRuntimeQuality);

  const tierRef = useRef<Tier>(0);
  const badCountRef = useRef(0);
  const goodCountRef = useRef(0);
  const frameRef = useRef(0);

  const TARGET_P95_MS = 22;
  const RECOVER_P95_MS = 18;
  const BAD_NEED = 14;
  const GOOD_NEED = 22;
  const CHECK_EVERY = 12;

  useFrame(() => {
    bench.tick();
    frameRef.current += 1;

    if (frameRef.current % CHECK_EVERY !== 0) return;

    const stats = bench.stats();
    const isBad = stats.p95Ms > TARGET_P95_MS;
    const isGood = stats.p95Ms < RECOVER_P95_MS;

    if (isBad) {
      badCountRef.current += 1;
      goodCountRef.current = 0;
    } else if (isGood) {
      goodCountRef.current += 1;
      badCountRef.current = 0;
    } else {
      badCountRef.current = Math.max(0, badCountRef.current - 1);
      goodCountRef.current = Math.max(0, goodCountRef.current - 1);
    }

    if (badCountRef.current >= BAD_NEED) {
      badCountRef.current = 0;
      tierRef.current = toTier(tierRef.current + 1);
      applyTier(tierRef.current, setRuntimeQuality);
    }

    const calls = renderer.info.render.calls;
    const triangles = renderer.info.render.triangles;
    const heavyScene = calls > 250 || triangles > 1_500_000;

    if (!heavyScene && goodCountRef.current >= GOOD_NEED) {
      goodCountRef.current = 0;
      tierRef.current = toTier(tierRef.current - 1);
      applyTier(tierRef.current, setRuntimeQuality);
    }
  });

  useEffect(() => {
    applyTier(0, setRuntimeQuality);
  }, [setRuntimeQuality]);

  return null;
}
