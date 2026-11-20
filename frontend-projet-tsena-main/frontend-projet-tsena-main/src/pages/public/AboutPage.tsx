import { Link } from 'react-router-dom';
import { ShieldCheck, Users, Store, Scale, Lock, Smartphone, Star, PackageCheck, type LucideIcon } from 'lucide-react';
import { useTitle } from '../../hooks';
import { SITE } from '../../lib/site';

interface InfoItem {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly desc: string;
}

const VALUES: InfoItem[] = [
  { icon: ShieldCheck, title: 'Confiance', desc: 'Chaque paiement est protégé par un séquestre jusqu’à la réception de la commande.' },
  { icon: Users, title: 'Proximité', desc: 'Des vendeurs malgaches vérifiés : artisans, commerçants, producteurs.' },
  { icon: Store, title: 'Diversité', desc: 'Artisanat, mode, électronique, agroalimentaire… un catalogue qui s’enrichit chaque jour.' },
  { icon: Scale, title: 'Équité', desc: 'En cas de désaccord, notre équipe arbitre le litige et peut rembourser l’acheteur.' },
];

const COMMITMENTS: InfoItem[] = [
  { icon: Lock, title: 'Paiement en séquestre', desc: 'Le montant de votre commande est conservé par Tsena et n’est versé au vendeur qu’après votre confirmation de réception.' },
  { icon: Smartphone, title: 'Moyens de paiement locaux', desc: 'MVola, Orange Money, Airtel Money ou paiement en espèces à la livraison.' },
  { icon: PackageCheck, title: 'Suivi de commande', desc: 'Suivez chaque étape depuis votre espace : confirmation, préparation, expédition, livraison.' },
  { icon: Star, title: 'Avis & badges', desc: 'Les avis ne peuvent être laissés qu’après une commande livrée ; les vendeurs fiables obtiennent des badges.' },
];

export default function AboutPage() {
  useTitle('À propos');
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-fade-in-up">
      <h1 className="text-3xl font-bold text-primary mb-2">À propos de {SITE.name}</h1>
      <p className="text-muted mb-8 max-w-3xl">{SITE.description}</p>

      <h2 className="sr-only">Nos valeurs</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {VALUES.map((item) => (
          <div key={item.title} className="bg-surface rounded-xl border border-border p-5 text-center">
            <item.icon size={32} className="mx-auto text-primary mb-3" aria-hidden="true" />
            <h3 className="font-semibold text-text mb-1">{item.title}</h3>
            <p className="text-sm text-muted">{item.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-primary mb-4">Nos engagements</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {COMMITMENTS.map((item) => (
          <div key={item.title} className="flex gap-4 bg-surface rounded-xl border border-border p-5">
            <div className="shrink-0 p-2 rounded-lg bg-primary/10 h-fit"><item.icon size={24} className="text-primary" aria-hidden="true" /></div>
            <div><h3 className="font-semibold text-text mb-1">{item.title}</h3><p className="text-sm text-muted">{item.desc}</p></div>
          </div>
        ))}
      </div>

      <section className="bg-surface rounded-xl border border-border p-6 mb-12" aria-labelledby="disputes-heading">
        <h2 id="disputes-heading" className="text-xl font-bold text-primary mb-2">Litiges & remboursements</h2>
        <p className="text-sm text-muted leading-relaxed">
          Un article non conforme ou jamais reçu ? Tant que vous n’avez pas confirmé la réception, votre paiement reste bloqué.
          Ouvrez un litige depuis la commande concernée, joignez vos preuves (photos, échanges) : un administrateur Tsena examine
          le dossier et tranche en faveur de l’acheteur, du vendeur, ou propose un remboursement partiel. Les décisions sont
          tracées et notifiées aux deux parties.
        </p>
      </section>

      <section id="cgu" className="bg-surface rounded-xl border border-border p-6 mb-12 scroll-mt-24" aria-labelledby="cgu-heading" data-testid="about-cgu">
        <h2 id="cgu-heading" className="text-xl font-bold text-primary mb-3">Conditions générales d’utilisation</h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-muted leading-relaxed">
          <li><strong className="text-text">Compte.</strong> L’inscription requiert des informations exactes ; vous êtes responsable de la confidentialité de vos identifiants. Un compte peut être suspendu en cas de fraude ou de non-respect des présentes conditions.</li>
          <li><strong className="text-text">Rôle de Tsena.</strong> Tsena met en relation acheteurs et vendeurs indépendants. Le vendeur reste responsable de ses produits, de leur conformité et de leur expédition.</li>
          <li><strong className="text-text">Paiement et séquestre.</strong> Les paiements en ligne sont conservés en séquestre jusqu’à la confirmation de réception par l’acheteur ou l’expiration du délai de confirmation automatique, puis reversés au vendeur déduction faite de la commission applicable.</li>
          <li><strong className="text-text">Livraison, réception et litiges.</strong> L’acheteur dispose d’un délai défini après la livraison pour confirmer la réception ou signaler un problème. Les litiges sont instruits par Tsena ; la décision (remboursement total, partiel ou maintien de la transaction) est motivée, tracée et notifiée aux deux parties.</li>
          <li><strong className="text-text">Avis et messagerie.</strong> Les avis portent sur des transactions réelles ; les contenus abusifs peuvent être masqués ou supprimés. La messagerie est réservée aux échanges liés à une boutique, un produit ou une commande.</li>
          <li><strong className="text-text">Données personnelles.</strong> La date de naissance et le sexe sont facultatifs et servent uniquement au calcul de l’âge, à la personnalisation et à des statistiques anonymisées. Les communications commerciales dépendent d’un consentement explicite, révocable à tout moment depuis votre profil.</li>
        </ol>
        <p className="text-xs text-muted mt-3">Version du 3 octobre 2026 — ce résumé opérationnel sera complété par la version juridique validée avant la mise en production.</p>
      </section>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
        <Store size={40} className="mx-auto text-primary mb-3" aria-hidden="true" />
        <h2 className="text-xl font-bold text-primary mb-2">Vous êtes vendeur ?</h2>
        <p className="text-muted mb-4">
          Créez votre boutique en quelques minutes. Votre compte est validé par notre équipe, puis vous publiez vos produits
          et êtes payé dès que vos clients confirment la réception.
        </p>
        <Link to="/inscription/vendeur" className="inline-block bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-dark transition-colors">
          Devenir vendeur
        </Link>
      </div>
    </div>
  );
}
