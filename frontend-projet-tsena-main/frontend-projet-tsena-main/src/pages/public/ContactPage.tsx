import { useId, useState, type FormEvent } from 'react';
import { MapPin, Phone, Mail, Clock, Send, MessageSquareWarning } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTitle } from '../../hooks';
import { CONTACT } from '../../lib/site';
import Button from '../../components/common/Button';

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const EMPTY_FORM: ContactForm = { name: '', email: '', subject: '', message: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPage() {
  useTitle('Contact');
  const uid = useId();
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [prepared, setPrepared] = useState(false);

  const field = (key: keyof ContactForm) => ({
    id: `${uid}-${key}`,
    value: form[key],
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${uid}-${key}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
  });

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Veuillez indiquer votre nom.';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Veuillez saisir une adresse e-mail valide.';
    if (!form.subject.trim()) next.subject = 'Veuillez préciser le sujet de votre message.';
    if (form.message.trim().length < 10) next.message = 'Votre message doit contenir au moins 10 caractères.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const body = `${form.message.trim()}\n\n—\n${form.name.trim()}\n${form.email.trim()}`;
    const href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(`[Tsena] ${form.subject.trim()}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setPrepared(true);
  };

  const inputClass = (key: keyof ContactForm) =>
    `w-full px-4 py-2.5 border rounded-lg bg-input-bg text-text focus:outline-none focus:border-primary ${errors[key] ? 'border-danger' : 'border-input-border'}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-fade-in-up">
      <h1 className="text-3xl font-bold text-primary mb-2">Contactez-nous</h1>
      <p className="text-muted mb-8">Une question, un problème ou une suggestion ? Nous sommes à votre écoute.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="font-bold text-text mb-4">Nos coordonnées</h2>
            <ul className="space-y-4 list-none m-0 p-0">
              <li className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><MapPin size={20} className="text-primary" aria-hidden="true" /></div>
                <div><p className="font-medium text-text">Adresse</p><p className="text-sm text-muted">{CONTACT.address}</p></div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Phone size={20} className="text-primary" aria-hidden="true" /></div>
                <div><p className="font-medium text-text">Téléphone</p><a href={`tel:${CONTACT.phoneHref}`} className="text-sm text-muted hover:text-primary">{CONTACT.phone}</a></div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Mail size={20} className="text-primary" aria-hidden="true" /></div>
                <div><p className="font-medium text-text">E-mail</p><a href={`mailto:${CONTACT.email}`} className="text-sm text-muted hover:text-primary">{CONTACT.email}</a></div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Clock size={20} className="text-primary" aria-hidden="true" /></div>
                <div><p className="font-medium text-text">Horaires</p><p className="text-sm text-muted">{CONTACT.hours}</p></div>
              </li>
            </ul>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex gap-3">
            <MessageSquareWarning size={22} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-muted">
              Un problème avec une commande reçue ? Ouvrez un litige directement depuis{' '}
              <Link to="/dashboard/client/mes-commandes" className="text-primary font-medium hover:underline">vos commandes</Link>{' '}
              : votre paiement reste bloqué le temps de l’arbitrage.
            </p>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-6">
          {prepared ? (
            <div className="text-center py-10 animate-fade-in-up" role="status">
              <Send size={48} className="mx-auto text-primary mb-4" aria-hidden="true" />
              <h2 className="text-xl font-bold text-text mb-2">Votre message est prêt</h2>
              <p className="text-muted">
                Votre application de messagerie s’est ouverte avec votre message. Si ce n’est pas le cas, écrivez-nous
                directement à <a href={`mailto:${CONTACT.email}`} className="text-primary font-medium hover:underline">{CONTACT.email}</a>.
              </p>
              <button type="button" onClick={() => { setPrepared(false); setForm(EMPTY_FORM); }} className="text-primary font-medium mt-4 hover:underline">
                Rédiger un autre message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h2 className="font-bold text-text mb-1">Envoyez-nous un message</h2>
              <p className="text-xs text-muted mb-4">Le message sera ouvert dans votre application e-mail, prêt à être envoyé.</p>
              <div className="space-y-4">
                <div>
                  <label htmlFor={`${uid}-name`} className="block text-sm font-medium text-text mb-1">Nom complet</label>
                  <input type="text" autoComplete="name" className={inputClass('name')} {...field('name')} />
                  {errors.name && <p id={`${uid}-name-error`} className="text-xs text-danger mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor={`${uid}-email`} className="block text-sm font-medium text-text mb-1">E-mail</label>
                  <input type="email" autoComplete="email" className={inputClass('email')} {...field('email')} />
                  {errors.email && <p id={`${uid}-email-error`} className="text-xs text-danger mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor={`${uid}-subject`} className="block text-sm font-medium text-text mb-1">Sujet</label>
                  <input type="text" className={inputClass('subject')} {...field('subject')} />
                  {errors.subject && <p id={`${uid}-subject-error`} className="text-xs text-danger mt-1">{errors.subject}</p>}
                </div>
                <div>
                  <label htmlFor={`${uid}-message`} className="block text-sm font-medium text-text mb-1">Message</label>
                  <textarea rows={4} className={`${inputClass('message')} resize-none`} {...field('message')} />
                  {errors.message && <p id={`${uid}-message-error`} className="text-xs text-danger mt-1">{errors.message}</p>}
                </div>
                <Button type="submit" icon={Send} fullWidth>
                  Préparer l’e-mail
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
