"use client";

import { useRef, useEffect, useCallback } from "react";

// ── SVG Shape ────────────────────────────────────────────
const SVG_PATH = `M1148.11 611.629L769.614 713.047L1148.11 814.466V1147.97L769.614 1046.55L391.114 945.129V758H668.035L668.135 757.63L769.427 379.597L769.614 379.547L1148.11 278.129V611.629ZM334.635 0.370117L435.569 377.068L536.506 0.370117L536.605 0L871.141 0L870.972 0.629883L769.553 379.13L769.427 379.597L391.114 480.965L391.114 758H203.104L203.005 757.63L101.587 379.13L0.167969 0.629883L0 0L334.535 0L334.635 0.370117Z`;
const SVG_WIDTH = 1149;
const SVG_HEIGHT = 1148;

export interface ParticlesConfig {
  gridSize: number;
  attractRadius: number;
  repelRadius: number;
  attractStrength: number;
  repelStrength: number;
  flickerChance: number;
  breatheIntensity: number;
  animDuration: number;
  dimming: number;
}

export const DEFAULT_CONFIG: ParticlesConfig = {
  gridSize: 2.1,
  attractRadius: 180,
  repelRadius: 100,
  attractStrength: 0.06,
  repelStrength: 1.2,
  flickerChance: 0.15,
  breatheIntensity: 0.14,
  dimming: 0,
  animDuration: 3000,
};

// ── SVG Utilities ───────────────────────────────────────

/**
 * Fit the SVG into the viewport with a uniform scale + center. `scaleMul`
 * is a final knob the caller can use to shrink/grow the logo (the VC mark
 * looks best around 0.4 of the viewport's smaller dimension).
 */
function getLogoTransform(
  viewportW: number,
  viewportH: number,
  scaleMul: number,
  svgW: number,
  svgH: number
): { scale: number; offsetX: number; offsetY: number } {
  const baseScale = Math.min(viewportW / svgW, viewportH / svgH) * 0.4;
  const scale = baseScale * scaleMul;
  const offsetX = (viewportW - svgW * scale) / 2;
  const offsetY = (viewportH - svgH * scale) / 2;
  return { scale, offsetX, offsetY };
}

/**
 * Sample the SVG path at a grid of points. Returns the centers of every
 * cell that lies inside the path, along with a small edge-distance hint
 * (1 for cells touching the boundary, 5 for interior cells) used by the
 * renderer to vary density and brightness.
 */
function fillSVGPath(
  pathData: string,
  gridSize: number,
  svgW: number,
  svgH: number
): { x: number; y: number; edgeDist: number }[] {
  if (typeof document === "undefined") return [];
  const canvas = document.createElement("canvas");
  canvas.width = svgW;
  canvas.height = svgH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const path = new Path2D(pathData);

  const cols = Math.ceil(svgW / gridSize);
  const rows = Math.ceil(svgH / gridSize);
  const inside = new Uint8Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * gridSize + gridSize / 2;
      const y = r * gridSize + gridSize / 2;
      if (ctx.isPointInPath(path, x, y)) {
        inside[r * cols + c] = 1;
      }
    }
  }

  // Quick edge classification: any inside cell with at least one non-inside
  // 4-neighbour is an edge cell. The renderer only uses this as a coarse
  // density hint, so the simplification is fine and keeps init fast.
  const points: { x: number; y: number; edgeDist: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (inside[idx] !== 1) continue;
      const isEdge =
        (r > 0 && inside[(r - 1) * cols + c] !== 1) ||
        (r < rows - 1 && inside[(r + 1) * cols + c] !== 1) ||
        (c > 0 && inside[r * cols + (c - 1)] !== 1) ||
        (c < cols - 1 && inside[r * cols + (c + 1)] !== 1) ||
        r === 0 ||
        r === rows - 1 ||
        c === 0 ||
        c === cols - 1;
      points.push({
        x: c * gridSize + gridSize / 2,
        y: r * gridSize + gridSize / 2,
        edgeDist: isEdge ? 1 : 5,
      });
    }
  }
  return points;
}

// ── Particles Shader ──────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  jitterX: number;
  jitterY: number;
  delay: number;
  alpha: number;
  flickerPhase: number;
  flickerSpeed: number;
  isFlickering: boolean;
  flickerStart: number;
  density: number;
  brightnessSeed: number;
  diagNorm: number;
  transitionRand: number;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface Props {
  config?: ParticlesConfig;
  playing?: boolean;
  resetKey?: number;
  transitionKey?: number;
  svgScale?: number;
  theme?: "light" | "dark";
  svgPath?: string;
  svgWidth?: number;
  svgHeight?: number;
  colorFn?: ((x: number, y: number, w: number, h: number) => string) | null;
  /** When true, the canvas uses `absolute inset-0` so it can sit inside a
   *  positioned container. Defaults to `fixed inset-0`. */
  contained?: boolean;
}

export default function ParticlesShader({
  config = DEFAULT_CONFIG,
  playing = true,
  resetKey = 0,
  transitionKey = 0,
  svgScale = 1,
  theme = "dark",
  svgPath = SVG_PATH,
  svgWidth = SVG_WIDTH,
  svgHeight = SVG_HEIGHT,
  colorFn,
  contained = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const configRef = useRef(config);
  const playingRef = useRef(playing);
  const pausedAtRef = useRef<number | null>(null);
  const pauseOffsetRef = useRef(0);
  const themeRef = useRef(theme);
  const colorFnRef = useRef(colorFn);
  const transitionStartRef = useRef<number | null>(null);
  const oldConfigRef = useRef<ParticlesConfig | null>(null);
  const oldColorFnRef = useRef<
    ((x: number, y: number, w: number, h: number) => string) | null
  >(null);
  const revealedRef = useRef<Uint8Array>(new Uint8Array(0));
  const prevTransitionKeyRef = useRef(transitionKey);

  if (
    transitionKey !== prevTransitionKeyRef.current &&
    transitionKey > 0
  ) {
    oldConfigRef.current = { ...configRef.current };
    oldColorFnRef.current = colorFnRef.current ?? null;
    transitionStartRef.current = performance.now();
    const particles = particlesRef.current;
    revealedRef.current = new Uint8Array(particles.length);
    for (let i = 0; i < particles.length; i++) {
      particles[i].transitionRand = Math.random() * 0.3;
    }
    prevTransitionKeyRef.current = transitionKey;
  }

  configRef.current = config;
  playingRef.current = playing;
  themeRef.current = theme;
  colorFnRef.current = colorFn;

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cfg = configRef.current;
    const points = fillSVGPath(svgPath, cfg.gridSize, svgWidth, svgHeight);
    const { scale, offsetX, offsetY } = getLogoTransform(
      width,
      height,
      svgScale,
      svgWidth,
      svgHeight
    );

    const centerX = width / 2;
    const centerY = height / 2;

    const filteredPoints = points.filter((point) => {
      const edgeProb = point.edgeDist <= 2 ? 1 : 0.6;
      const logoCenter = { x: svgWidth / 2, y: svgHeight / 2 };
      const distFromCenter = Math.sqrt(
        Math.pow(point.x - logoCenter.x, 2) +
          Math.pow(point.y - logoCenter.y, 2)
      );
      const maxDist = Math.sqrt(
        logoCenter.x * logoCenter.x + logoCenter.y * logoCenter.y
      );
      const normalizedDist = distFromCenter / maxDist;
      const densityFactor = 0.65 + 0.25 * Math.cos(normalizedDist * Math.PI);
      return Math.random() < edgeProb * densityFactor;
    });

    const particles: Particle[] = filteredPoints.map((point) => {
      const targetX = point.x * scale + offsetX;
      const targetY = point.y * scale + offsetY;

      const jitterAmount = 1.5 + Math.random() * 2;
      const jitterX = (Math.random() - 0.5) * jitterAmount;
      const jitterY = (Math.random() - 0.5) * jitterAmount;

      const angle = Math.random() * Math.PI * 2;
      const minRadius = Math.max(width, height) * 0.6;
      const maxRadius = Math.max(width, height) * 1.2;
      const spawnRadius = minRadius + Math.random() * (maxRadius - minRadius);
      const angleJitter = (Math.random() - 0.5) * 0.5;
      const finalAngle = angle + angleJitter;

      const startX =
        centerX +
        Math.cos(finalAngle) * spawnRadius +
        (Math.random() - 0.5) * 200;
      const startY =
        centerY +
        Math.sin(finalAngle) * spawnRadius +
        (Math.random() - 0.5) * 200;

      const distFromCenterVal = Math.sqrt(
        Math.pow(targetX - centerX, 2) + Math.pow(targetY - centerY, 2)
      );
      const maxDistVal = Math.sqrt(
        Math.pow(width / 2, 2) + Math.pow(height / 2, 2)
      );
      const normalizedDist = distFromCenterVal / maxDistVal;

      const baseDelay = normalizedDist * 0.6;
      const randomDelay = Math.random() * 0.25;
      const delay = baseDelay + randomDelay;

      const isFlickering = Math.random() < cfg.flickerChance;
      const diagNorm = (targetX / width + targetY / height) / 2;

      return {
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        targetX: targetX + jitterX,
        targetY: targetY + jitterY,
        startX,
        startY,
        jitterX,
        jitterY,
        delay,
        alpha: 0,
        flickerPhase: Math.random() * Math.PI * 2,
        flickerSpeed: 0.5 + Math.random() * 2,
        isFlickering,
        flickerStart: 4000 + Math.random() * 2000,
        density: point.edgeDist / 10,
        brightnessSeed: Math.random(),
        diagNorm,
        transitionRand: Math.random() * 0.3,
      };
    });

    particlesRef.current = particles;
    startTimeRef.current = null;
  }, [svgScale, svgPath, svgWidth, svgHeight]);

  useEffect(() => {
    init();
    window.addEventListener("resize", init);
    return () => window.removeEventListener("resize", init);
  }, [init]);

  useEffect(() => {
    if (resetKey > 0) {
      startTimeRef.current = null;
      pauseOffsetRef.current = 0;
      pausedAtRef.current = null;
      init();
    }
  }, [resetKey, init]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };
    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) mouseRef.current = { x: t.clientX, y: t.clientY, active: true };
    };
    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) mouseRef.current = { x: t.clientX, y: t.clientY, active: true };
    };
    const handleTouchEnd = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let imgData: ImageData | null = null;
    let lastCW = 0;
    let lastCH = 0;
    let dimFactors: Float32Array | null = null;
    let lastDimming = -1;
    let lastDimmingCount = -1;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;

      if (!playingRef.current) {
        pausedAtRef.current = timestamp;
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      if (pausedAtRef.current !== null) {
        pauseOffsetRef.current += timestamp - pausedAtRef.current;
        pausedAtRef.current = null;
      }

      const cfg = configRef.current;
      const elapsed = timestamp - startTimeRef.current - pauseOffsetRef.current;
      const duration = cfg.animDuration;
      const globalProgress = Math.min(elapsed / duration, 1);

      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.width;
      const ch = canvas.height;
      const width = cw / dpr;
      const height = ch / dpr;

      const isLight = themeRef.current === "light";

      if (!imgData || cw !== lastCW || ch !== lastCH) {
        imgData = ctx.createImageData(cw, ch);
        lastCW = cw;
        lastCH = ch;
      }
      const buf = imgData.data;
      const bgR = isLight ? 245 : 0;
      const bgG = isLight ? 245 : 0;
      const bgB = isLight ? 245 : 0;
      for (let j = 0, len = buf.length; j < len; j += 4) {
        buf[j] = bgR;
        buf[j + 1] = bgG;
        buf[j + 2] = bgB;
        buf[j + 3] = 255;
      }

      const mouse = mouseRef.current;
      const particles = particlesRef.current;
      const pLen = particles.length;

      if (cfg.dimming !== lastDimming || pLen !== lastDimmingCount) {
        lastDimming = cfg.dimming;
        lastDimmingCount = pLen;
        dimFactors = new Float32Array(pLen);
        if (cfg.dimming > 0) {
          const exp = 1 + cfg.dimming * 16;
          for (let i = 0; i < pLen; i++) {
            dimFactors[i] = Math.pow(particles[i].brightnessSeed, exp);
          }
        } else {
          dimFactors.fill(1);
        }
      }

      const inTransition = transitionStartRef.current !== null;
      let waveFront = 0;
      let sweepDone = false;
      let oldCfg: ParticlesConfig | null = null;
      let oldDimFactors: Float32Array | null = null;
      if (inTransition) {
        const tElapsed = (timestamp - transitionStartRef.current!) * 0.001;
        const sweepDuration = 1.8;
        waveFront = (tElapsed / sweepDuration) * 1.6 - 0.3;
        oldCfg = oldConfigRef.current;
        if (oldCfg && oldCfg.dimming > 0) {
          oldDimFactors = new Float32Array(pLen);
          const oldExp = 1 + oldCfg.dimming * 16;
          for (let i = 0; i < pLen; i++) {
            oldDimFactors[i] = Math.pow(particles[i].brightnessSeed, oldExp);
          }
        }
        if (tElapsed > sweepDuration + 0.5) sweepDone = true;
      }

      const oldCfnFn = oldColorFnRef.current;
      const newCfnFn = colorFnRef.current;
      const defR = isLight ? 0 : 255;
      const defG = isLight ? 0 : 255;
      const defB = isLight ? 0 : 255;

      for (let i = 0; i < pLen; i++) {
        const p = particles[i];

        const pd = globalProgress - p.delay;
        const particleProgress =
          pd <= 0 ? 0 : pd >= 1 - p.delay ? 1 : pd / (1 - p.delay);
        if (particleProgress <= 0) continue;

        const easedProgress = easeOutQuart(particleProgress);
        const baseX = p.startX + (p.targetX - p.startX) * easedProgress;
        const baseY = p.startY + (p.targetY - p.startY) * easedProgress;

        if (mouse.active && particleProgress > 0.3) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist2 = dx * dx + dy * dy;
          const attractR = cfg.attractRadius;

          if (dist2 < attractR * attractR && dist2 > 0) {
            const dist = Math.sqrt(dist2);
            const repelR = cfg.repelRadius;
            if (dist < repelR) {
              const force = (1 - dist / repelR) * cfg.repelStrength;
              const f = (force * repelR * 0.15) / dist;
              p.vx += dx * f;
              p.vy += dy * f;
            } else {
              const normalizedDist = (dist - repelR) / (attractR - repelR);
              const force = (1 - normalizedDist) * cfg.attractStrength;
              const range = attractR - repelR;
              const f = (force * range * 0.08) / dist;
              p.vx -= dx * f;
              p.vy -= dy * f;
            }
          }
        }

        const dtx = baseX - p.x;
        const dty = baseY - p.y;
        const distToTarget2 = dtx * dtx + dty * dty;
        const normalizedDist =
          distToTarget2 > 90000 ? 1 : Math.sqrt(distToTarget2) / 300;
        const easeInFactor = normalizedDist * normalizedDist * normalizedDist;
        const returnStrength = 0.008 + easeInFactor * 0.12;

        p.vx += dtx * returnStrength;
        p.vy += dty * returnStrength;

        const dampingFactor = 0.92 - easeInFactor * 0.08;
        p.vx *= dampingFactor;
        p.vy *= dampingFactor;

        p.x += p.vx;
        p.y += p.vy;

        let alpha = particleProgress * 2;
        if (alpha > 1) alpha = 1;

        if (
          p.isFlickering &&
          elapsed > p.flickerStart &&
          particleProgress >= 1
        ) {
          const flickerCycle = Math.sin(
            (elapsed - p.flickerStart) * 0.003 * p.flickerSpeed +
              p.flickerPhase
          );
          if (flickerCycle < -0.7) {
            alpha = easeInOutCubic((flickerCycle + 1) / 0.3) * 0.3;
          } else if (flickerCycle < -0.4) {
            alpha = 0.3 + ((flickerCycle + 0.7) / 0.3) * 0.7;
          }
        }

        let useOldConfig = false;
        let transitionAlphaMul = 1;
        if (inTransition) {
          const distFromWave = p.diagNorm + p.transitionRand - waveFront;
          if (distFromWave > 0.2) {
            useOldConfig = true;
          } else if (distFromWave > 0) {
            useOldConfig = true;
            const f = distFromWave * 5;
            transitionAlphaMul = f * f;
          } else if (distFromWave > -0.2) {
            const f = 1 + distFromWave * 5;
            transitionAlphaMul = f * f;
          }
        }

        const activeCfg = useOldConfig && oldCfg ? oldCfg : cfg;

        if (particleProgress >= 1) {
          const breathe =
            Math.sin(elapsed * 0.001 + p.flickerPhase) *
            activeCfg.breatheIntensity;
          alpha += breathe;
          if (alpha < 0.2) alpha = 0.2;
          else if (alpha > 1) alpha = 1;
        }

        if (activeCfg.dimming > 0) {
          const factors =
            useOldConfig && oldDimFactors ? oldDimFactors : dimFactors!;
          alpha *= factors[i];
        }
        alpha *= transitionAlphaMul;

        if (alpha < 0.005) {
          p.alpha = 0;
          continue;
        }
        p.alpha = alpha;

        const activeCfn =
          useOldConfig && oldCfnFn !== null ? oldCfnFn : newCfnFn;
        let cr: number, cg: number, cb: number;
        if (activeCfn) {
          const rgb = activeCfn(p.x, p.y, width, height);
          const c1 = rgb.indexOf(",");
          const c2 = rgb.indexOf(",", c1 + 1);
          cr = +rgb.substring(0, c1);
          cg = +rgb.substring(c1 + 1, c2);
          cb = +rgb.substring(c2 + 1);
        } else {
          cr = defR;
          cg = defG;
          cb = defB;
        }

        const a = isLight
          ? alpha * 1.4 + 0.1 > 1
            ? 1
            : alpha * 1.4 + 0.1
          : alpha;
        const px = Math.round(p.x * dpr) | 0;
        const py = Math.round(p.y * dpr) | 0;

        if (px >= 0 && px < cw && py >= 0 && py < ch) {
          const inv = 1 - a;
          const blendR = (bgR * inv + cr * a) | 0;
          const blendG = (bgG * inv + cg * a) | 0;
          const blendB = (bgB * inv + cb * a) | 0;
          const idx = (py * cw + px) * 4;
          buf[idx] = blendR;
          buf[idx + 1] = blendG;
          buf[idx + 2] = blendB;

          if (isLight) {
            if (px + 1 < cw) {
              const j = idx + 4;
              buf[j] = blendR;
              buf[j + 1] = blendG;
              buf[j + 2] = blendB;
            }
            if (py + 1 < ch) {
              const j = idx + cw * 4;
              buf[j] = blendR;
              buf[j + 1] = blendG;
              buf[j + 2] = blendB;
            }
            if (px + 1 < cw && py + 1 < ch) {
              const j = idx + cw * 4 + 4;
              buf[j] = blendR;
              buf[j + 1] = blendG;
              buf[j + 2] = blendB;
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      if (sweepDone) {
        transitionStartRef.current = null;
        oldConfigRef.current = null;
        oldColorFnRef.current = null;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const positionClass = contained ? "absolute inset-0" : "fixed inset-0";
  return (
    <canvas
      ref={canvasRef}
      className={`${positionClass} h-full w-full`}
      style={{
        background: theme === "light" ? "#f5f5f5" : "#000",
        touchAction: "none",
      }}
    />
  );
}
