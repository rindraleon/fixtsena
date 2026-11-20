import { Outlet } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import SkipLink from '../components/common/SkipLink';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SkipLink />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
