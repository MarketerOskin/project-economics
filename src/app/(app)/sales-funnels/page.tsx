import { redirect } from 'next/navigation';

/** Old address of «Продажи и обращения», now a tab of «Маркетинг и продажи». */
export default function SalesFunnelsRedirect() {
  redirect('/marketing/funnels');
}
