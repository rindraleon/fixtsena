import { useTitle } from '../hooks';
import CategorySidebar from '../components/home/CategorySidebar';
import HeroSection from '../components/home/HeroSection';
import PopularCategories from '../components/home/PopularCategories';
import HowItWorksSection from '../components/home/HowItWorksSection';
import FlashSaleSection from '../components/home/FlashSaleSection';
import BenefitsSection from '../components/home/BenefitsSection';

export default function HomePage() {
  useTitle('Accueil', { description: 'Achetez et vendez en toute confiance à Madagascar : artisanat, mode, électronique, produits du terroir. Paiement protégé en séquestre, mobile money ou paiement à la livraison.' });
  return (
    <>
      <section className="bg-surface" aria-label="Bienvenue sur Tsena">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex gap-4">
            <CategorySidebar />
            <div className="flex-1 min-w-0">
              <HeroSection />
            </div>
          </div>
        </div>
      </section>

      <PopularCategories />
      <FlashSaleSection />
      <HowItWorksSection />
      <BenefitsSection />
    </>
  );
}
