import { route } from '@/server/handler';
import { updateSupportPackage } from '@/server/api/support-package';

export const dynamic = 'force-dynamic';

export const PATCH = route<{ id: string }>(updateSupportPackage);
