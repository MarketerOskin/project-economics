import { PageTransition } from '@/components/motion/page-transition';

/** A template re-mounts on every navigation, so each screen gets its entrance (ADR-065). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
