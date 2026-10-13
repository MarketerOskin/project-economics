import { z } from 'zod';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

/** Report branding (ADR-054). `logo`: a data URL to replace it, null to remove, absent to keep. */
export const brandSchema = z.object({
  companyName: text(200),
  requisites: text(2000),
  contacts: text(500),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в формате #RRGGBB')
    .nullable()
    .optional(),
  signerName: text(200),
  signerTitle: text(200),
  footerNote: text(1000),
  logo: z.string().max(800_000).nullable().optional(),
});
export type BrandInput = z.infer<typeof brandSchema>;
