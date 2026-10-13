import type { ReportPalette } from '@/lib/brand';

/**
 * The top of a client-facing report in the installing company's style (ADR-054): their logo,
 * name and contacts, an accent bar, then the report title. Shared by the report and the
 * preview in settings so both always look the same.
 */
export interface LetterheadBrand {
  companyName: string | null;
  contacts: string | null;
  logoUrl: string | null;
}

export function ReportLetterhead({
  brand,
  palette,
  kicker,
  title,
  subtitle,
}: {
  brand: LetterheadBrand;
  palette: ReportPalette;
  kicker: string;
  title: string;
  subtitle?: string | null;
}) {
  return (
    <header>
      <div style={{ height: 6, background: palette.accent }} />
      <div className="flex items-center justify-between gap-6 px-8 pt-6">
        <div className="flex min-h-12 items-center">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={brand.companyName ?? ''}
              className="max-h-14 max-w-[200px] object-contain"
            />
          ) : brand.companyName ? (
            <div className="text-[18px] font-bold" style={{ color: palette.accent }}>
              {brand.companyName}
            </div>
          ) : null}
        </div>
        <div className="text-right text-[11px] leading-snug text-[#55554f]">
          {brand.logoUrl && brand.companyName ? (
            <div className="text-[13px] font-semibold text-[#111]">{brand.companyName}</div>
          ) : null}
          {brand.contacts ? <div className="whitespace-pre-line">{brand.contacts}</div> : null}
        </div>
      </div>
      <div className="px-8 pt-6">
        <div
          className="text-[11px] font-bold tracking-[0.12em] uppercase"
          style={{ color: palette.accent }}
        >
          {kicker}
        </div>
        <div className="mt-1 text-[24px] leading-tight font-bold text-[#111]">{title}</div>
        {subtitle ? <div className="mt-0.5 text-[13px] text-[#55554f]">{subtitle}</div> : null}
      </div>
    </header>
  );
}

/** Requisites and the signature lines at the end of the report. */
export function ReportSignoff({
  palette,
  requisites,
  signerName,
  signerTitle,
  clientName,
  footerNote,
}: {
  palette: ReportPalette;
  requisites: string | null;
  signerName: string | null;
  signerTitle: string | null;
  clientName: string | null;
  footerNote: string | null;
}) {
  return (
    <footer className="mt-8 break-inside-avoid">
      <div className="grid grid-cols-2 gap-8 text-[12px]">
        <div>
          <div className="text-[11px] text-[#6d6d65]">Исполнитель</div>
          <div className="mt-8 border-t border-[#b9b9b0] pt-1">
            {signerName ?? ''}
            {signerTitle ? <span className="text-[#6d6d65]">, {signerTitle}</span> : null}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#6d6d65]">Заказчик</div>
          <div className="mt-8 border-t border-[#b9b9b0] pt-1">{clientName ?? ''}</div>
        </div>
      </div>
      {footerNote ? (
        <p className="mt-5 text-[11px] whitespace-pre-line text-[#55554f]">{footerNote}</p>
      ) : null}
      {requisites ? (
        <div
          className="mt-5 border-t pt-3 text-[10px] leading-snug whitespace-pre-line text-[#6d6d65]"
          style={{ borderColor: palette.soft }}
        >
          {requisites}
        </div>
      ) : null}
    </footer>
  );
}
