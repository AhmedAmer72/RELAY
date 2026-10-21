"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { animate, motion, useInView, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils/cn";

type TimelineContextValue = {
  textRef: RefObject<HTMLDivElement | null>;
  leftPos: number;
  rightPos: number;
  textHeight: number;
  handleWidth: number;
  handleLeftStart: (clientX: number) => void;
  handleRightStart: (clientX: number) => void;
};

const TimelineContext = createContext<TimelineContextValue | null>(null);

function useTimelineContext() {
  const context = useContext(TimelineContext);
  if (!context) throw new Error("Timeline components must be used within a Timeline");
  return context;
}

const HANDLE = 28;

export function Timeline({
  children,
  rotation = -1.2,
  initialLeft = 0,
  minWidth = 56,
  className,
  containerClassName,
  handleClassName,
  handleIndicatorClassName,
}: {
  children: ReactNode;
  rotation?: number;
  initialLeft?: number;
  minWidth?: number;
  className?: string;
  containerClassName?: string;
  handleClassName?: string;
  handleIndicatorClassName?: string;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rightMotion = useMotionValue(initialLeft + minWidth);
  const isInView = useInView(containerRef, { amount: 0.3 });
  const [textWidth, setTextWidth] = useState(0);
  const [textHeight, setTextHeight] = useState(0);
  const [leftPos, setLeftPos] = useState(initialLeft);
  const [rightPos, setRightPos] = useState(initialLeft + minWidth);

  useEffect(() => rightMotion.on("change", setRightPos), [rightMotion]);

  useEffect(() => {
    const measure = () => {
      const text = textRef.current;
      if (!text) return;
      setTextWidth(text.offsetWidth);
      setTextHeight(text.offsetHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [children]);

  useEffect(() => {
    if (!textWidth) return;
    const fullRight = textWidth + HANDLE * 2;
    const closed = leftPos + minWidth;
    animate(rightMotion, isInView ? fullRight : closed, {
      duration: 0.7,
      ease: isInView ? [0.22, 1, 0.36, 1] : "easeInOut",
    });
  }, [isInView, leftPos, minWidth, rightMotion, textWidth]);

  const stopDrag = (move: (event: MouseEvent) => void, touch: (event: TouchEvent) => void, end: () => void) => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", end);
    document.removeEventListener("touchmove", touch);
    document.removeEventListener("touchend", end);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const handleLeftStart = useCallback(
    (clientX: number) => {
      rightMotion.stop();
      const startLeft = leftPos;
      const startX = clientX;
      const moveTo = (x: number) => {
        const next = Math.max(0, Math.min(startLeft + (x - startX), rightPos - minWidth));
        setLeftPos(next);
      };
      const mouseMove = (event: MouseEvent) => moveTo(event.clientX);
      const touchMove = (event: TouchEvent) => moveTo(event.touches[0].clientX);
      const end = () => stopDrag(mouseMove, touchMove, end);
      document.addEventListener("mousemove", mouseMove);
      document.addEventListener("mouseup", end);
      document.addEventListener("touchmove", touchMove, { passive: true });
      document.addEventListener("touchend", end);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [leftPos, minWidth, rightMotion, rightPos],
  );

  const handleRightStart = useCallback(
    (clientX: number) => {
      rightMotion.stop();
      const startRight = rightPos;
      const startX = clientX;
      const maxRight = textWidth + HANDLE * 2;
      const moveTo = (x: number) => {
        const next = Math.max(leftPos + minWidth, Math.min(startRight + (x - startX), maxRight));
        rightMotion.set(next);
      };
      const mouseMove = (event: MouseEvent) => moveTo(event.clientX);
      const touchMove = (event: TouchEvent) => moveTo(event.touches[0].clientX);
      const end = () => stopDrag(mouseMove, touchMove, end);
      document.addEventListener("mousemove", mouseMove);
      document.addEventListener("mouseup", end);
      document.addEventListener("touchmove", touchMove, { passive: true });
      document.addEventListener("touchend", end);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [leftPos, minWidth, rightMotion, rightPos, textWidth],
  );

  const width = Math.max(0, rightPos - leftPos);

  return (
    <TimelineContext.Provider value={{ textRef, leftPos, rightPos, textHeight, handleWidth: HANDLE, handleLeftStart, handleRightStart }}>
      <div
        ref={containerRef}
        className={cn("relative", className)}
        style={{ width: textWidth ? textWidth + HANDLE * 2 : undefined, transform: `rotate(${rotation}deg)` }}
      >
        <div className={cn("relative overflow-hidden", containerClassName)} style={{ width, marginLeft: leftPos, height: textHeight || undefined }}>
          <div style={{ transform: `translateX(${-leftPos}px)` }}>{children}</div>
        </div>
        <Handle edge="start" className={handleClassName} indicatorClassName={handleIndicatorClassName} />
        <Handle edge="end" className={handleClassName} indicatorClassName={handleIndicatorClassName} />
      </div>
    </TimelineContext.Provider>
  );
}

function Handle({
  edge,
  className,
  indicatorClassName,
}: {
  edge: "start" | "end";
  className?: string;
  indicatorClassName?: string;
}) {
  const { leftPos, rightPos, textHeight, handleWidth, handleLeftStart, handleRightStart } = useTimelineContext();
  const start = edge === "start";
  return (
    <motion.button
      type="button"
      aria-label={start ? "Drag the start of the line" : "Drag the end of the line"}
      className={cn(
        "absolute top-0 z-20 flex w-7 cursor-ew-resize select-none items-center justify-center rounded-full border border-meadow bg-white",
        className,
      )}
      style={{ height: textHeight || undefined, left: start ? leftPos : rightPos - handleWidth }}
      onMouseDown={(event) => (start ? handleLeftStart(event.clientX) : handleRightStart(event.clientX))}
      onTouchStart={(event) => (start ? handleLeftStart(event.touches[0].clientX) : handleRightStart(event.touches[0].clientX))}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className={cn("h-4 w-1 rounded-full bg-brand", indicatorClassName)} />
    </motion.button>
  );
}

export function TimelineText({ children, className }: { children: ReactNode; className?: string }) {
  const { textRef } = useTimelineContext();
  return (
    <div ref={textRef} className={cn("w-max whitespace-nowrap", className)}>
      {children}
    </div>
  );
}
