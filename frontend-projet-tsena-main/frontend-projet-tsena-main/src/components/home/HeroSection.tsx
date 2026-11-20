import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ShoppingBag, ShieldCheck, BadgeCheck, Smartphone, Store } from 'lucide-react';
import { cn } from '../../lib/utils';
import AnimatedTitlePath from './AnimatedTitlePath';

interface HeroSectionProps {
  readonly className?: string;
}

const benefits = [
  { icon: ShieldCheck, label: 'Paiement protégé' },
  { icon: BadgeCheck, label: 'Vendeurs vérifiés' },
  { icon: Smartphone, label: 'Mobile money' },
];

function HeroVisual({ className }: { readonly className?: string }) {
  return (
    <div
      className={cn('relative flex w-full items-center justify-center lg:justify-end', className)}
      aria-hidden="true"
    >
      <AnimatedTitlePath
        text="TSENA"
        caption="Marketplace malgache"
        className="h-auto w-40 sm:w-52 lg:w-full lg:max-w-[420px]"
      />
    </div>
  );
}

export default function HeroSection({ className }: HeroSectionProps) {
  const reduceMotion = useReducedMotion();
  const blobA = useRef<HTMLDivElement>(null);
  const blobB = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      reduceMotion ||
      typeof window === 'undefined' ||
      !window.matchMedia('(pointer: fine)').matches
    )
      return;
    let frame = 0;
    const handleMouseMove = (event: MouseEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const x = (event.clientX / window.innerWidth - 0.5) * 20;
        const y = (event.clientY / window.innerHeight - 0.5) * 20;
        if (blobA.current) blobA.current.style.transform = `translate(${x * 0.5}px, ${y * 0.5}px)`;
        if (blobB.current)
          blobB.current.style.transform = `translate(${x * -0.3}px, ${y * -0.3}px)`;
      });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  return (
    <section
      className={cn(
        'hero-shell relative isolate flex w-full flex-col overflow-hidden rounded-2xl shadow-xl shadow-primary/10',
        className,
      )}
      style={{ background: 'linear-gradient(135deg, #0d3b2e 0%, #1a5c47 40%, #2d8a6b 100%)' }}
      aria-labelledby="hero-title"
    >
      <div
        ref={blobA}
        className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full opacity-20 blur-2xl transition-transform duration-300 ease-out sm:size-96"
        style={{ background: 'radial-gradient(circle, #f0c040 0%, transparent 68%)' }}
        aria-hidden="true"
      />
      <div
        ref={blobB}
        className="pointer-events-none absolute -bottom-28 -left-20 size-64 rounded-full opacity-15 blur-2xl transition-transform duration-300 ease-out sm:size-80"
        style={{ background: 'radial-gradient(circle, #a7f3d0 0%, transparent 68%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.07),transparent_38%,transparent_72%,rgba(255,255,255,0.05))]"
        aria-hidden="true"
      />

      <div className="relative z-10 grid min-h-[300px] flex-1 items-center gap-4 px-5 py-5 sm:min-h-[320px] sm:px-8 sm:py-7 lg:min-h-[360px] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8 lg:px-10 lg:py-8">
        <div className="min-w-0">
          <motion.div
            className="flex flex-col gap-3 sm:gap-4"
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-accent shadow-sm backdrop-blur-sm sm:text-xs">
              <span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_rgba(240,192,64,0.9)]" />
              La marketplace malgache
            </p>

            <h1
              id="hero-title"
              className="max-w-[14ch] text-balance font-[Manrope] text-[clamp(2rem,4.4vw,3.5rem)] font-extrabold leading-[1.04] tracking-[-0.055em] text-white"
              style={{
                textShadow: '0 3px 24px rgba(0,0,0,0.14)',
              }}
            >
              Achetez <span className="bg-gradient-to-r from-[#f8d96e] via-[#f0c040] to-[#ffeaa0] bg-clip-text text-transparent">en confiance</span>
            </h1>

            <p className="max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
              Découvrez les produits malgaches avec un paiement protégé.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/produits"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-primary-dark shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:bg-accent-light hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ShoppingBag size={16} aria-hidden="true" />
                Voir les produits
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                to="/inscription/vendeur"
                className="inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-semibold text-white/90 transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Store size={15} aria-hidden="true" />
                Ouvrir ma boutique
              </Link>
            </div>

            <ul
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/15 pt-3 list-none m-0 p-0"
              aria-label="Nos engagements"
            >
              {benefits.map((benefit) => (
                <li
                  key={benefit.label}
                  className="flex items-center gap-1.5 text-white/80 text-[11px] font-medium sm:text-xs"
                >
                  <benefit.icon size={13} className="text-accent shrink-0" aria-hidden="true" />
                  <span>{benefit.label}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <HeroVisual className="hidden lg:flex" />
      </div>
    </section>
  );
}
