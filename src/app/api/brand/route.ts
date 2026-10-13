import { route } from '@/server/handler';
import { getBrandRoute, putBrand } from '@/server/api/brand';

export const dynamic = 'force-dynamic';

export const GET = route(getBrandRoute);
export const PUT = route(putBrand);
