import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, BellOff, Heart } from 'lucide-react';
import { Button, ConfirmDialog } from '../common';
import { useAuth } from '../../context/AuthContext';
import { useToggleFollowShop } from '../../hooks/mutations/useShopMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import type { ApiShop, ProductShopSummary } from '../../types/api';

interface FollowShopButtonProps {
  readonly shop: Pick<ApiShop, 'id' | 'slug' | 'status' | 'ownerId'> & Partial<Pick<ApiShop, 'isFollowing' | 'followersCount'>>;
  readonly size?: 'sm' | 'md';
  readonly fullWidth?: boolean;
}

export default function FollowShopButton({ shop, size = 'md', fullWidth }: FollowShopButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toggle = useToggleFollowShop();
  const confirmUnfollow = useConfirmAction<true>();

  const isOwner = user?.id === shop.ownerId;
  const suspended = shop.status !== 'active';
  const following = !!shop.isFollowing;

  if (isOwner) return null;

  const handleClick = () => {
    if (!user) {
      navigate('/connexion', { state: { from: location.pathname + location.search } });
      return;
    }
    if (following) {
      confirmUnfollow.request(true);
      return;
    }
    toggle.mutate({ shopId: shop.id, follow: true, slug: shop.slug });
  };

  return (
    <>
      <Button
        variant={following ? 'outline' : 'primary'}
        size={size}
        icon={following ? Bell : Heart}
        onClick={handleClick}
        disabled={suspended}
        loading={toggle.isPending}
        loadingLabel={following ? 'Mise à jour...' : 'Abonnement...'}
        fullWidth={fullWidth}
        title={suspended ? 'Cette boutique est suspendue : abonnement impossible' : undefined}
        aria-pressed={following}
        data-testid="shop-follow-button"
      >
        {following ? 'Abonné' : suspended ? 'Boutique indisponible' : 'Suivre la boutique'}
      </Button>
      <ConfirmDialog
        open={confirmUnfollow.isOpen}
        title="Se désabonner de cette boutique ?"
        description="Vous ne recevrez plus les notifications de nouveaux produits et de promotions de cette boutique."
        confirmLabel="Se désabonner"
        loadingLabel="Désabonnement..."
        loading={toggle.isPending}
        onConfirm={() => void confirmUnfollow.run(() => toggle.mutateAsync({ shopId: shop.id, follow: false, slug: shop.slug }))}
        onCancel={confirmUnfollow.cancel}
      >
        <p className="text-xs text-muted flex items-center gap-1.5"><BellOff size={13} /> Vous pourrez vous réabonner à tout moment.</p>
      </ConfirmDialog>
    </>
  );
}

export function toFollowableShop(summary: ProductShopSummary, ownerId: string): FollowShopButtonProps['shop'] {
  return { id: summary.id, slug: summary.slug, status: summary.status, ownerId };
}
