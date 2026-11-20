import { useScrollToTop } from '../../hooks';
import BackToTop from './BackToTop';

export default function ScrollManager() {
  useScrollToTop();
  return <BackToTop />;
}
