import { requireOperatorSession } from '@/server/operator-page-session';
import { PortalsDashboard } from '@/components/operator/portals-dashboard';

export const dynamic = 'force-dynamic';

export default async function OperatorPage() {
  const { operatorEmail } = await requireOperatorSession();
  return <PortalsDashboard operatorEmail={operatorEmail} />;
}
