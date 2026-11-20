import { Phone, Mail, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ACCEPTED_PAYMENTS, CONTACT, SITE } from '../../lib/site';

const LINK_CLASS =
  'text-white/70 text-[11px] sm:text-xs hover:text-accent transition-colors focus-visible:outline-none focus-visible:text-accent';

const NAV_LINKS = [
  { label: 'Tous les produits', href: '/produits' },
  { label: 'Promotions', href: '/promotions' },
  { label: 'Boutiques', href: '/boutiques' },
  { label: 'Suivre ma commande', href: '/dashboard/client/mes-commandes' },
  { label: 'Devenir vendeur', href: '/inscription/vendeur' },
  { label: 'À propos', href: '/a-propos' },
] as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary-dark relative isolate overflow-hidden" role="contentinfo">
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="footer-watermark">{SITE.name}</span>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-5 md:py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-2"
            aria-label={`Accueil ${SITE.name}`}
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary-dark">
              <span className="text-sm font-extrabold leading-none">T</span>
            </span>
            <span className="min-w-0">
              <span className="block text-base font-extrabold leading-none tracking-tight text-white">
                {SITE.name}
              </span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase leading-none tracking-[0.16em] text-white/50">
                Marketplace
              </span>
            </span>
          </Link>

          <nav aria-label="Navigation du pied de page" className="min-w-0">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 list-none m-0 p-0">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className={LINK_CLASS}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`tel:${CONTACT.phoneHref}`}
              aria-label={CONTACT.phone}
              title={CONTACT.phone}
              className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/70 transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Phone size={14} aria-hidden="true" />
            </a>
            <a
              href={`mailto:${CONTACT.email}`}
              aria-label={CONTACT.email}
              title={CONTACT.email}
              className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/70 transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Mail size={14} aria-hidden="true" />
            </a>
            <Link
              to="/contact"
              className="group inline-flex h-8 items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2.5 text-[11px] font-semibold text-accent transition-colors hover:border-accent/50 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Nous contacter
              <ArrowUpRight
                size={12}
                className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-3 text-[11px] text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              © {currentYear} {SITE.name}. Tous droits réservés.
            </span>
            <span className="inline-flex items-center gap-1 text-white/60">
              <ShieldCheck size={12} aria-hidden="true" /> Paiement protégé jusqu’à réception
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="uppercase tracking-[0.1em] text-white/40">Nous acceptons</span>
            {ACCEPTED_PAYMENTS.map((method) => (
              <span
                key={method}
                className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/75 ring-1 ring-inset ring-white/10"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
