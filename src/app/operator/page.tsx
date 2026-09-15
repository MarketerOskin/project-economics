import { requireOperatorSession } from '@/server/operator-page-session';
import { OperatorDashboard } from '@/components/operator/operator-dashboard';

export const dynamic = 'force-dynamic';

export default async function OperatorPage() {
  const { operatorEmail } = await requireOperatorSession();
  return <OperatorDashboard operatorEmail={operatorEmail} />;
}
