import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface AnimatedTitlePathProps {
  readonly text: string;
  readonly caption?: string;
  readonly className?: string;
  readonly drawDurationSeconds?: number;
  readonly holdDurationSeconds?: number;
}

const VIEWBOX_WIDTH = 340;
const VIEWBOX_HEIGHT = 130;
const TITLE_FONT_SIZE = 84;
const FALLBACK_CHAR_WIDTH = 0.62;

export default function AnimatedTitlePath({
  text,
  caption,
  className,
  drawDurationSeconds = 2.6,
  holdDurationSeconds = 1.4,
}: AnimatedTitlePathProps) {
  const rawId = useId();
  const gradientId = `hero-gradient-${rawId.replace(/[^a-zA-Z0-9-]/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const textRef = useRef<SVGTextElement>(null);
  const [measuredLength, setMeasuredLength] = useState(0);
  const reduceMotion = useReducedMotion();

  const dashLength = useMemo(() => {
    if (measuredLength > 0) return measuredLength;
    return Math.ceil(Math.max(140, text.length * TITLE_FONT_SIZE * FALLBACK_CHAR_WIDTH));
  }, [measuredLength, text]);

  useLayoutEffect(() => {
    const node = textRef.current;
    if (!node) return;
    let cancelled = false;
    let frame = 0;

    const measure = () => {
      if (cancelled) return;
      let length = 0;
      try {
        length = node.getComputedTextLength();
      } catch {
        length = 0;
      }
      if (length > 0) setMeasuredLength(Math.ceil(length));
    };

    frame = window.requestAnimationFrame(measure);
    if (typeof document.fonts?.ready?.then === 'function') {
      void document.fonts.ready.then(measure).catch(() => undefined);
    }

    const observer =
      typeof ResizeObserver !== 'undefined' && svgRef.current ? new ResizeObserver(measure) : null;
    if (observer && svgRef.current) observer.observe(svgRef.current);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [text]);

  const titleStyle = useMemo(
    () => ({
      fontFamily: 'Manrope, sans-serif',
      fontSize: TITLE_FONT_SIZE,
      fontWeight: 800,
      letterSpacing: '-0.055em',
    }) as const,
    [],
  );

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={text}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8d96e" />
          <stop offset="45%" stopColor="#f0c040" />
          <stop offset="100%" stopColor="#a7f3d0" />
        </linearGradient>
      </defs>

      <text
        ref={textRef}
        x="50%"
        y="70%"
        textAnchor="middle"
        style={titleStyle}
        fill="rgba(255,255,255,0.16)"
      >
        {text}
      </text>

      {!reduceMotion && (
        <motion.text
          aria-hidden="true"
          key={dashLength}
          x="50%"
          y="70%"
          textAnchor="middle"
          style={titleStyle}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashLength}
          initial={{ strokeDashoffset: dashLength }}
          animate={{ strokeDashoffset: 0 }}
          transition={{
            duration: drawDurationSeconds,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatType: 'loop',
            repeatDelay: holdDurationSeconds,
          }}
        >
          {text}
        </motion.text>
      )}

      {caption && (
        <motion.text
          x="50%"
          y={VIEWBOX_HEIGHT - 12}
          textAnchor="middle"
          fill="rgba(255,255,255,0.8)"
          style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em' }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: reduceMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {caption}
        </motion.text>
      )}
    </svg>
  );
}
