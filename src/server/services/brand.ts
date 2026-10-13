import type { PortalBrand, PortalInstallation } from '@prisma/client';
import type { PortalScope } from '@/lib/db/with-portal';
import type { ResolvedSession } from '@/lib/auth/resolve';
import { badRequest } from '@/lib/errors';
import { callBitrix, fetchBitrixFile } from '@/lib/bitrix/client';
import { LOGO_MAX_BYTES, normalizeHex, sniffLogo } from '@/lib/brand';
import type { BrandInput } from '@/server/dto/brand';

/**
 * Report branding (ADR-054): the installing company's name, logo, colour and requisites, used
 * on client-facing reports instead of the app's own look.
 */

export interface BrandDto {
  companyName: string | null;
  requisites: string | null;
  contacts: string | null;
  accentColor: string | null;
  signerName: string | null;
  signerTitle: string | null;
  footerNote: string | null;
  /** `/api/brand/logo?v=…`, or null without a logo. */
  logoUrl: string | null;
}

export function brandDto(b: PortalBrand | null): BrandDto {
  return {
    companyName: b?.companyName ?? null,
    requisites: b?.requisites ?? null,
    contacts: b?.contacts ?? null,
    accentColor: b?.accentColor ?? null,
    signerName: b?.signerName ?? null,
    signerTitle: b?.signerTitle ?? null,
    footerNote: b?.footerNote ?? null,
    logoUrl: b?.logo ? `/api/brand/logo?v=${b.updatedAt.getTime()}` : null,
  };
}

export async function getBrand(scope: PortalScope): Promise<BrandDto> {
  return brandDto(await scope.brand.get());
}

function decodeLogo(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const m = dataUrl.match(/^data:[^;,]+;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw badRequest('Логотип должен быть картинкой PNG, JPEG или WEBP');
  const bytes = new Uint8Array(Buffer.from(m[1]!, 'base64'));
  if (bytes.byteLength > LOGO_MAX_BYTES) throw badRequest('Логотип больше 512 КБ, уменьшите его');
  const mime = sniffLogo(bytes);
  if (!mime) throw badRequest('Логотип должен быть картинкой PNG, JPEG или WEBP');
  return { bytes, mime };
}

export async function saveBrand(
  session: ResolvedSession,
  scope: PortalScope,
  input: BrandInput,
): Promise<BrandDto> {
  const logo =
    input.logo === undefined
      ? {}
      : input.logo === null
        ? { logo: null, logoMime: null }
        : (() => {
            const l = decodeLogo(input.logo);
            return { logo: Buffer.from(l.bytes), logoMime: l.mime };
          })();
  const row = await scope.brand.upsert({
    companyName: input.companyName ?? null,
    requisites: input.requisites ?? null,
    contacts: input.contacts ?? null,
    accentColor: normalizeHex(input.accentColor),
    signerName: input.signerName ?? null,
    signerTitle: input.signerTitle ?? null,
    footerNote: input.footerNote ?? null,
    updatedById: session.user.id,
    ...logo,
  });
  return brandDto(row);
}

export async function brandLogo(
  scope: PortalScope,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const b = await scope.brand.get();
  return b?.logo && b.logoMime ? { bytes: b.logo, mime: b.logoMime } : null;
}

/** What «Подтянуть из Битрикс24» suggests: the form shows it, the admin reviews and saves. */
export interface BrandSuggestion {
  companyName: string | null;
  requisites: string | null;
  contacts: string | null;
  signerName: string | null;
  signerTitle: string | null;
  /** data URL of the CRM company logo, when it could be downloaded. */
  logo: string | null;
  notes: string[];
}

interface MultiField {
  VALUE?: string;
}
interface CompanyRow {
  ID: string;
  TITLE?: string;
  PHONE?: MultiField[];
  EMAIL?: MultiField[];
  WEB?: MultiField[];
  LOGO?: { downloadUrl?: string; showUrl?: string } | null;
}
interface RequisiteRow {
  ID: string;
  RQ_COMPANY_NAME?: string;
  RQ_COMPANY_FULL_NAME?: string;
  RQ_INN?: string;
  RQ_KPP?: string;
  RQ_OGRN?: string;
  RQ_OGRNIP?: string;
  RQ_DIRECTOR?: string;
}
interface AddressRow {
  TYPE_ID?: string;
  POSTAL_CODE?: string;
  CITY?: string;
  ADDRESS_1?: string;
  ADDRESS_2?: string;
}
interface BankRow {
  RQ_BANK_NAME?: string;
  RQ_BIK?: string;
  RQ_ACC_NUM?: string;
  RQ_COR_ACC_NUM?: string;
}

const joinLines = (lines: Array<string | null | undefined | false>) => {
  const s = lines.filter(Boolean).join('\n').trim();
  return s || null;
};
const first = (f?: MultiField[]) => f?.find((x) => x.VALUE)?.VALUE ?? null;

export const DEMO_BRAND_SUGGESTION: BrandSuggestion = {
  companyName: 'ООО «Токсичная компания»',
  requisites:
    'ООО «Токсичная компания»\nИНН 7700000000, КПП 770001001, ОГРН 1207700000000\n125009, Москва, ул. Тверская, 1\nр/с 40702810000000000000 в АО «Банк», БИК 044525000',
  contacts: '+7 495 000-00-00 · hello@example.ru · example.ru',
  signerName: 'Анна Ковалёва',
  signerTitle: 'Генеральный директор',
  logo: null,
  notes: [],
};

/** Reads «Моя компания» from CRM: name, contacts, logo, requisites, address and bank. */
export async function suggestBrandFromBitrix(
  portal: PortalInstallation,
  demo: boolean,
): Promise<BrandSuggestion> {
  if (demo) return DEMO_BRAND_SUGGESTION;
  const notes: string[] = [];
  const companies = await callBitrix<CompanyRow[]>(portal, 'crm.company.list', {
    filter: { IS_MY_COMPANY: 'Y' },
    select: ['ID', 'TITLE'],
    order: { ID: 'ASC' },
  });
  const id = companies[0]?.ID;
  if (!id) {
    return {
      companyName: null,
      requisites: null,
      contacts: null,
      signerName: null,
      signerTitle: null,
      logo: null,
      notes: [
        'В CRM нет «Моей компании». Заполните её в Битрикс24 (CRM → Настройки → Мои реквизиты) или внесите данные здесь.',
      ],
    };
  }
  const company = await callBitrix<CompanyRow>(portal, 'crm.company.get', { id });
  const requisites = await callBitrix<RequisiteRow[]>(portal, 'crm.requisite.list', {
    filter: { ENTITY_TYPE_ID: 4, ENTITY_ID: id },
    order: { SORT: 'ASC', ID: 'ASC' },
  }).catch(() => [] as RequisiteRow[]);
  const rq = requisites[0];
  const [addresses, banks] = rq
    ? await Promise.all([
        callBitrix<AddressRow[]>(portal, 'crm.address.list', {
          filter: { ENTITY_TYPE_ID: 8, ENTITY_ID: rq.ID },
        }).catch(() => [] as AddressRow[]),
        callBitrix<BankRow[]>(portal, 'crm.requisite.bankdetail.list', {
          filter: { ENTITY_ID: rq.ID },
        }).catch(() => [] as BankRow[]),
      ])
    : [[], []];
  if (!rq) notes.push('У «Моей компании» нет реквизитов в CRM, их можно вписать вручную.');

  // Legal address (TYPE_ID 6) first, then any.
  const addr = addresses.find((a) => a.TYPE_ID === '6') ?? addresses[0];
  const bank = banks[0];
  const name = rq?.RQ_COMPANY_NAME || rq?.RQ_COMPANY_FULL_NAME || company.TITLE || null;

  let logo: string | null = null;
  const logoUrl = company.LOGO?.downloadUrl;
  if (logoUrl) {
    const file = await fetchBitrixFile(portal, logoUrl, LOGO_MAX_BYTES);
    const mime = file ? sniffLogo(file.bytes) : null;
    if (file && mime) logo = `data:${mime};base64,${Buffer.from(file.bytes).toString('base64')}`;
    else notes.push('Логотип из CRM загрузить не удалось, добавьте его файлом.');
  } else {
    notes.push('У «Моей компании» в CRM нет логотипа, добавьте его файлом.');
  }

  return {
    companyName: company.TITLE || name,
    requisites: joinLines([
      rq?.RQ_COMPANY_FULL_NAME || name,
      [
        rq?.RQ_INN && `ИНН ${rq.RQ_INN}`,
        rq?.RQ_KPP && `КПП ${rq.RQ_KPP}`,
        (rq?.RQ_OGRN || rq?.RQ_OGRNIP) && `ОГРН ${rq?.RQ_OGRN || rq?.RQ_OGRNIP}`,
      ]
        .filter(Boolean)
        .join(', '),
      addr &&
        [addr.POSTAL_CODE, addr.CITY, addr.ADDRESS_1, addr.ADDRESS_2].filter(Boolean).join(', '),
      bank &&
        [
          bank.RQ_ACC_NUM && `р/с ${bank.RQ_ACC_NUM}`,
          bank.RQ_BANK_NAME && `в ${bank.RQ_BANK_NAME}`,
          bank.RQ_BIK && `БИК ${bank.RQ_BIK}`,
          bank.RQ_COR_ACC_NUM && `к/с ${bank.RQ_COR_ACC_NUM}`,
        ]
          .filter(Boolean)
          .join(', '),
    ]),
    contacts: joinLines([
      [first(company.PHONE), first(company.EMAIL), first(company.WEB)].filter(Boolean).join(' · '),
    ]),
    signerName: rq?.RQ_DIRECTOR || null,
    signerTitle: rq?.RQ_DIRECTOR ? 'Генеральный директор' : null,
    logo,
    notes,
  };
}
