export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration: number;
  createdAt: number;
}

export interface ToastOptions {
  id?: string;
  description?: string;
  duration?: number;
}

type Listener = (toasts: ToastItem[]) => void;

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000,
};

const MAX_VISIBLE = 5;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const listener of listeners) listener(toasts);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function scheduleDismiss(id: string, duration: number): void {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  if (duration <= 0) return;
  timers.set(
    id,
    setTimeout(() => dismiss(id), duration),
  );
}

function show(type: ToastType, message: string, options: ToastOptions = {}): string {
  const id = options.id ?? `${type}:${slug(message)}`;
  const duration = options.duration ?? DEFAULT_DURATION[type];

  const existing = toasts.find((t) => t.id === id);
  if (existing) {
    toasts = toasts.map((t) =>
      t.id === id ? { ...t, message, description: options.description, createdAt: Date.now() } : t,
    );
    scheduleDismiss(id, duration);
    emit();
    return id;
  }

  const item: ToastItem = {
    id,
    type,
    message,
    description: options.description,
    duration,
    createdAt: Date.now(),
  };
  toasts = [...toasts, item].slice(-MAX_VISIBLE);
  scheduleDismiss(id, duration);
  emit();
  return id;
}

export function dismiss(id: string): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function dismissAll(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  toasts = [];
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastItem[] {
  return toasts;
}

export const toast = {
  success: (message: string, options?: ToastOptions) => show('success', message, options),
  error: (message: string, options?: ToastOptions) => show('error', message, options),
  info: (message: string, options?: ToastOptions) => show('info', message, options),
  warning: (message: string, options?: ToastOptions) => show('warning', message, options),
  dismiss,
  dismissAll,
};

export const TOAST_MESSAGES = {
  auth: {
    loginSuccess: 'Connexion réussie',
    loginError: 'Échec de la connexion',
    registerSuccess: 'Compte créé avec succès',
    logoutSuccess: 'Déconnexion réussie',
    logoutError: 'Échec de la déconnexion côté serveur — vous avez été déconnecté localement.',
    sessionExpired: 'Session expirée. Veuillez vous reconnecter.',
    profileUpdated: 'Profil mis à jour',
  },
  products: {
    created: 'Produit créé avec succès',
    updated: 'Produit modifié avec succès',
    deleted: 'Produit supprimé avec succès',
    createError: 'Impossible de créer le produit',
    updateError: 'Impossible de modifier le produit',
    deleteError: 'Impossible de supprimer le produit',
    imageAdded: 'Image ajoutée avec succès',
    imageDeleted: 'Image supprimée avec succès',
    imageError: "Impossible de téléverser l'image",
    coverUpdated: 'Image de couverture mise à jour',
    imagesReordered: 'Ordre des images enregistré',
    imageOrderError: "Impossible d'enregistrer l'ordre des images",
  },
  categories: {
    created: 'Catégorie créée avec succès',
    updated: 'Catégorie modifiée avec succès',
    deleted: 'Catégorie supprimée avec succès',
    createError: 'Impossible de créer la catégorie',
    updateError: 'Impossible de modifier la catégorie',
    deleteError: 'Impossible de supprimer la catégorie',
  },
  cart: {
    added: 'Article ajouté au panier',
    updated: 'Quantité mise à jour',
    removed: 'Article retiré du panier',
    cleared: 'Panier vidé',
    error: 'Impossible de mettre à jour le panier',
    stockLimit: 'Stock disponible atteint',
  },
  orders: {
    created: 'Commande créée avec succès',
    statusUpdated: 'Statut de la commande mis à jour',
    error: 'Impossible de traiter la commande',
    quoteError: 'Récapitulatif de commande indisponible',
  },
  users: {
    created: 'Utilisateur créé avec succès',
    updated: 'Utilisateur mis à jour',
    deleted: 'Utilisateur supprimé avec succès',
    deleteError: "Impossible de supprimer l'utilisateur",
  },
  reviews: {
    created: 'Avis publié avec succès',
    updated: 'Avis modifié avec succès',
    deleted: 'Avis supprimé avec succès',
    replied: 'Réponse publiée',
    reported: "Avis signalé : notre équipe va l'examiner",
    moderated: 'Avis mis à jour',
  },
  shops: {
    created: 'Boutique créée : complétez-la puis soumettez-la à vérification',
    updated: 'Boutique mise à jour',
    submitted: 'Boutique soumise à vérification',
    logoUpdated: 'Logo mis à jour',
    coverUpdated: 'Image de couverture mise à jour',
    followed: 'Vous suivez cette boutique',
    unfollowed: 'Vous ne suivez plus cette boutique',
    statusUpdated: 'Statut de la boutique mis à jour',
  },
  admin: {
    reportExported: (filename: string, rows: number | null) =>
      rows === null ? `Export « ${filename} » téléchargé` : `Export « ${filename} » téléchargé (${rows} ligne${rows > 1 ? 's' : ''})`,
  },
  subscriptions: {
    created: 'Abonnement créé : procédez au paiement pour l’activer',
    paid: 'Paiement confirmé : votre abonnement est actif',
    scheduled: (date: string) => `Paiement confirmé : votre abonnement prendra effet le ${date}`,
    cancelled: 'Abonnement annulé',
  },
  promotions: {
    created: 'Promotion créée : procédez au paiement pour l’activer',
    paid: 'Paiement confirmé : la promotion est active',
    cancelled: 'Promotion annulée',
    stopped: 'Promotion arrêtée',
  },
  messaging: {
    sent: 'Message envoyé',
    archived: 'Conversation archivée',
    unarchived: 'Conversation restaurée',
    blocked: 'Interlocuteur bloqué',
    unblocked: 'Interlocuteur débloqué',
    reported: "Message signalé : notre équipe va l'examiner",
  },
  notifications: {
    allRead: 'Toutes les notifications sont marquées comme lues',
  },
  settings: {
    updated: 'Paramètres enregistrés',
    reset: 'Paramètre réinitialisé',
    rateSaved: 'Taux de commission enregistré',
    rateRemoved: 'Taux spécifique supprimé',
    zoneSaved: 'Zone de livraison enregistrée',
    zoneRemoved: 'Zone de livraison supprimée',
  },
  server: {
    unavailable: 'Serveur indisponible',
  },
} as const;
