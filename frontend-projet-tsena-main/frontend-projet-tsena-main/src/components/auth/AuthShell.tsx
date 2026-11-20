import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import TsenaLogo from '../layout/TsenaLogo';

interface AuthShellProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly panelTitle: string;
  readonly panelText: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export default function AuthShell({ title, subtitle, panelTitle, panelText, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/5 rounded-full" aria-hidden="true" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent/10 rounded-full" aria-hidden="true" />
        <div className="max-w-md text-white relative z-10">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-8 relative">
            <span className="text-primary font-extrabold text-3xl relative z-10">T</span>
            <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold mb-3">{panelTitle}</p>
          <p className="text-white/70 text-sm leading-relaxed">{panelText}</p>
        </div>
      </div>

      <main id="main-content" className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md animate-fade-in-up">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary font-medium mb-6 transition-colors">
            <ArrowLeft size={16} /> Retour à l'accueil
          </Link>
          <div className="lg:hidden mb-8"><TsenaLogo size="md" /></div>
          <h1 className="text-2xl font-bold text-primary mb-1">{title}</h1>
          {subtitle && <p className="text-muted text-sm mb-6">{subtitle}</p>}
          {children}
          {footer && <div className="mt-6 space-y-1 text-sm text-muted text-center">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
