import { can, requirePermission } from '@/lib/permissions';
import { brandSchema } from '@/server/dto/brand';
import { brandLogo, getBrand, saveBrand, suggestBrandFromBitrix } from '@/server/services/brand';
import type { HandlerContext } from '@/server/handler';

/** Report branding (ADR-054). Anyone signed in can read it (reports use it); admins edit. */
export async function getBrandRoute({ scope }: HandlerContext) {
  return getBrand(scope);
}

export async function putBrand({ req, session, scope }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  return saveBrand(session, scope, brandSchema.parse(await req.json()));
}

export async function suggestBrand({ session }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  return suggestBrandFromBitrix(session.portal, session.demo);
}

export async function getLogo({ scope }: HandlerContext) {
  const logo = await brandLogo(scope);
  if (!logo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(logo.bytes), {
    headers: {
      'content-type': logo.mime,
      'cache-control': 'private, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}
