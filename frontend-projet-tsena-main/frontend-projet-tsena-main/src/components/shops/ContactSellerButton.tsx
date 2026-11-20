import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { Button } from '../common';
import { FormField } from '../form';
import { useAuth } from '../../context/AuthContext';
import { useStartConversation } from '../../hooks/mutations/useMessagingMutations';
import { hasAppRole } from '../../shared/data/permissions';

interface ContactSellerButtonProps {
  readonly sellerId: string;
  readonly productId?: string;
  readonly orderId?: string;
  readonly shopId?: string;
  readonly subjectHint?: string;
  readonly size?: 'sm' | 'md';
  readonly variant?: 'outline' | 'ghost' | 'primary';
  readonly fullWidth?: boolean;
  readonly label?: string;
}

export default function ContactSellerButton({ sellerId, productId, orderId, shopId, subjectHint, size = 'md', variant = 'outline', fullWidth, label = 'Contacter le vendeur' }: ContactSellerButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const start = useStartConversation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (user?.id === sellerId) return null;
  if (user && !hasAppRole(user.roles, 'client')) return null;

  const error = submitted && message.trim().length < 2 ? 'Écrivez votre message (2 caractères minimum).' : undefined;
  const messagesHref = hasAppRole(user?.roles, 'seller') && !productId && !orderId ? '/dashboard/vendeur/messages' : '/dashboard/client/messages';

  const openDialog = () => {
    if (!user) {
      navigate('/connexion', { state: { from: location.pathname + location.search } });
      return;
    }
    setOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (message.trim().length < 2 || start.isPending) return;
    start.mutate(
      { sellerId, productId, orderId, shopId, message: message.trim() },
      {
        onSuccess: ({ conversation }) => {
          setOpen(false);
          setMessage('');
          setSubmitted(false);
          navigate(`${messagesHref}?conversation=${conversation.id}`);
        },
      },
    );
  };

  return (
    <>
      <Button variant={variant} size={size} icon={MessageCircle} onClick={openDialog} fullWidth={fullWidth} data-testid="contact-seller-button">
        {label}
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div key="contact-seller-dialog" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !start.isPending && setOpen(false)}>
            <motion.form
              role="dialog"
              aria-modal="true"
              aria-labelledby="contact-seller-title"
              onSubmit={submit}
              noValidate
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              className="w-full max-w-lg bg-surface rounded-2xl border border-border shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="contact-seller-title" className="text-lg font-bold text-text">Envoyer un message au vendeur</h2>
                  {subjectHint && <p className="text-xs text-muted mt-0.5">À propos de « {subjectHint} »</p>}
                </div>
                <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-hover" aria-label="Fermer" disabled={start.isPending}><X size={18} /></button>
              </div>
              <FormField
                as="textarea"
                label="Votre message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Bonjour, ce produit est-il disponible en… ?"
                error={error}
                hint="Restez courtois : les échanges peuvent être consultés par la modération en cas de litige. Ne partagez pas de coordonnées bancaires."
                required
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={start.isPending}>Annuler</Button>
                <Button type="submit" icon={Send} loading={start.isPending} loadingLabel="Envoi...">Envoyer</Button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
