import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';
import { useTitle } from '../hooks';

interface UnavailableFeaturePageProps {
  readonly title: string;
  readonly icon?: ReactNode;
  readonly reason?: string;
  readonly backHref: string;
  readonly backLabel?: string;
}

export default function UnavailableFeaturePage({ title, icon, reason, backHref, backLabel = 'Retour au tableau de bord' }: UnavailableFeaturePageProps) {
  useTitle(title);
  return (
    <output className="bg-surface rounded-xl border border-border p-10 text-center">
      <div className="mb-4 text-primary inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">{icon ?? <Construction size={28} />}</div>
      <h1 className="text-xl font-bold text-text mb-2">{title}</h1>
      <p className="text-muted text-sm mb-1 font-medium">Fonctionnalité indisponible</p>
      <p className="text-muted text-sm max-w-md mx-auto">{reason ?? "Cette fonctionnalité n'est pas encore proposée par l'API de la plateforme."}</p>
      <Link to={backHref} className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-primary hover:underline"><ArrowLeft size={16} /> {backLabel}</Link>
    </output>
  );
}
