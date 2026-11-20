import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { pageVariants } from '../../lib/animations';

interface AnimatedPageProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export default function AnimatedPage({ children, className = '' }: AnimatedPageProps) {
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {children}
    </motion.div>
  );
}
