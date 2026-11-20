import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ShoppingCart, Lock, PackageCheck, Store, ArrowRight, type LucideIcon } from 'lucide-react';

interface Step {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
}

const STEPS: Step[] = [
  {
    icon: ShoppingCart,
    title: '1. Commandez',
    description: 'Ajoutez vos articles au panier et choisissez votre mode de paiement : MVola, Orange Money, Airtel Money ou paiement à la livraison.',
  },
  {
    icon: Lock,
    title: '2. Votre paiement est protégé',
    description: 'Le montant est conservé en séquestre par Tsena : le vendeur n’est pas payé tant que vous n’avez pas reçu votre commande.',
  },
  {
    icon: PackageCheck,
    title: '3. Confirmez la réception',
    description: 'À la livraison, confirmez la réception depuis votre espace client. En cas de problème, ouvrez un litige : notre équipe arbitre.',
  },
];

export default function HowItWorksSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="py-8 md:py-12" aria-labelledby="how-it-works-heading">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 bg-surface rounded-2xl border border-border p-6 md:p-8">
            <h2 id="how-it-works-heading" className="text-xl md:text-2xl font-bold text-primary">Comment fonctionne Tsena ?</h2>
            <p className="text-sm text-muted mt-1 mb-6">Un achat en trois étapes, avec un paiement protégé de bout en bout.</p>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 list-none m-0 p-0">
              {STEPS.map((step, idx) => (
                <motion.li
                  key={step.title}
                  className="flex flex-col gap-3"
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <step.icon size={22} aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-text">{step.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{step.description}</p>
                </motion.li>
              ))}
            </ol>
          </div>

          <motion.div
            className="relative overflow-hidden rounded-2xl bg-primary text-white p-6 md:p-8 flex flex-col justify-between min-h-[220px]"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-accent/20" aria-hidden="true" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                <Store size={22} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold leading-tight">Vous êtes artisan ou commerçant ?</h3>
              <p className="text-sm text-white/80 mt-2 leading-relaxed">
                Ouvrez votre boutique, publiez vos produits et soyez payé dès la réception confirmée par vos clients.
              </p>
            </div>
            <Link
              to="/inscription/vendeur"
              className="relative mt-5 inline-flex items-center gap-2 self-start bg-accent text-primary-dark font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-105 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Devenir vendeur <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
