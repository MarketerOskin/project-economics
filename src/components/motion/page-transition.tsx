'use client';

import { motion } from 'motion/react';

/** Every screen fades and rises in on navigation (used by the (app) template). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      // At rest motion leaves `transform: none`, so fixed-position children aren't trapped.
    >
      {children}
    </motion.div>
  );
}
