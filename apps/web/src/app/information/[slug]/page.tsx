import { notFound } from 'next/navigation';
import { platformInfo } from '@/lib/platform-info';
import { PlatformInformation } from '@/components/platform-information';

export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(platformInfo).map(slug => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = platformInfo[slug];
  return { title: page ? `${page.ar} | ${page.en} — نظام المحاسبة` : 'نظام المحاسبة', description: page?.ar === undefined ? '' : page.sections[0].ar[1] };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!Object.hasOwn(platformInfo, slug)) notFound();
  return <PlatformInformation slug={slug}/>;
}
