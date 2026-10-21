"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Direction =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

class Pixel {
  private ctx: CanvasRenderingContext2D;
  private x: number;
  private y: number;
  private color: string;
  private speed: number;
  private size = 0;
  private sizeStep: number;
  private minSize = 0.5;
  private maxSizeInteger = 2;
  private maxSize: number;
  private delay: number;
  private counter = 0;
  private counterStep: number;
  isIdle = false;
  private isReverse = false;
  private isShimmer = false;

  constructor(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    speed: number,
    delay: number,
  ) {
    this.ctx = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.random(0.1, 0.9) * speed;
    this.sizeStep = Math.random() * 0.4;
    this.maxSize = this.random(this.minSize, this.maxSizeInteger);
    this.delay = delay;
    this.counterStep = Math.random() * 4 + (context.canvas.width + context.canvas.height) * 0.01;
  }

  private random(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  private draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  appear() {
    this.isIdle = false;
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) this.isShimmer = true;
    if (this.isShimmer) this.shimmer();
    else this.size += this.sizeStep;
    this.draw();
  }

  private shimmer() {
    if (this.size >= this.maxSize) this.isReverse = true;
    else if (this.size <= this.minSize) this.isReverse = false;
    this.size += this.isReverse ? -this.speed : this.speed;
  }
}

function effectiveSpeed(value: number, reducedMotion: boolean) {
  if (value <= 0 || reducedMotion) return 0;
  if (value >= 100) return 0.1;
  return value * 0.001;
}

function originFor(direction: Direction, width: number, height: number) {
  switch (direction) {
    case "top":
      return { x: width / 2, y: 0 };
    case "bottom":
      return { x: width / 2, y: height };
    case "left":
      return { x: 0, y: height / 2 };
    case "right":
      return { x: width, y: height / 2 };
    case "top-left":
      return { x: 0, y: 0 };
    case "top-right":
      return { x: width, y: 0 };
    case "bottom-left":
      return { x: 0, y: height };
    case "bottom-right":
      return { x: width, y: height };
    default:
      return { x: width / 2, y: height / 2 };
  }
}

export default function PixelBackground({
  gap = 6,
  speed = 80,
  colors = "#dfe6d4,#e7f0dc,#c9d7bc,#b7c9a8",
  opacity = 1,
  direction = "center",
  className = "",
  canvasClassName = "",
  children,
}: {
  gap?: number;
  speed?: number;
  colors?: string;
  opacity?: number;
  direction?: Direction;
  className?: string;
  canvasClassName?: string;
  children?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const frameRef = useRef<number | null>(null);
  const previousRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const palette = colors.split(",").map((color) => color.trim()).filter(Boolean);
    const step = Math.max(1, gap);
    const pixelSpeed = effectiveSpeed(speed, reduced);

    const init = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = width;
      canvas.height = height;
      const origin = originFor(direction, width, height);
      const pixels: Pixel[] = [];
      for (let x = 0; x < width; x += step) {
        for (let y = 0; y < height; y += step) {
          const color = palette[Math.floor(Math.random() * palette.length)] ?? "#dfe6d4";
          const dx = x - origin.x;
          const dy = y - origin.y;
          pixels.push(new Pixel(ctx, x, y, color, pixelSpeed, reduced ? 0 : Math.hypot(dx, dy)));
        }
      }
      pixelsRef.current = pixels;
    };

    const tick = (now: number) => {
      frameRef.current = requestAnimationFrame(tick);
      if (previousRef.current === 0) previousRef.current = now;
      const elapsed = now - previousRef.current;
      if (elapsed < 1000 / 60) return;
      previousRef.current = now - (elapsed % (1000 / 60));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const pixel of pixelsRef.current) pixel.appear();
    };

    init();
    frameRef.current = requestAnimationFrame(tick);
    const observer = new ResizeObserver(() => {
      previousRef.current = 0;
      init();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [colors, direction, gap, speed]);

  return (
    <div ref={containerRef} className={className} style={{ opacity }}>
      <canvas ref={canvasRef} className={canvasClassName} />
      {children ? <div className="relative z-10">{children}</div> : null}
    </div>
  );
}
