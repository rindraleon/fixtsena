import { ShieldCheck, BadgeCheck, Scale, Smartphone, Star, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

interface Benefit {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
}

const benefits: Benefit[] = [
  { icon: ShieldCheck, title: 'Paiement protégé', description: 'Fonds conservés en séquestre jusqu’à la réception' },
  { icon: BadgeCheck, title: 'Vendeurs vérifiés', description: 'Comptes validés par l’équipe Tsena' },
  { icon: Scale, title: 'Litiges pris en charge', description: 'Médiation et remboursement si nécessaire' },
  { icon: Smartphone, title: 'Paiement flexible', description: 'MVola, Orange Money, Airtel Money ou à la livraison' },
  { icon: Star, title: 'Avis & badges', description: 'Des évaluations réelles, laissées après livraison' },
];

export default function BenefitsSection() {
  const reduceMotion = useReducedMotion();
  return (
    <section className="py-8 md:py-12 bg-surface border-y border-border" aria-label="Nos engagements">
      <div className="max-w-7xl mx-auto px-4">
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 md:gap-8 list-none m-0 p-0">
          {benefits.map((benefit, idx) => (
            <motion.li
              key={benefit.title}
              className="flex items-start gap-3"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-primary shrink-0 mt-0.5"><benefit.icon size={24} aria-hidden="true" /></div>
              <div>
                <h3 className="font-semibold text-sm text-text">{benefit.title}</h3>
                <p className="text-xs text-muted mt-0.5">{benefit.description}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
