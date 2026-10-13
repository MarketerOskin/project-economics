import { redirect } from 'next/navigation';

/** «Автоматизация» moved into settings as «Авторасчёт финансов» (ADR-045); old links keep working. */
export default function AutomationPage() {
  redirect('/settings/auto-finance');
}
