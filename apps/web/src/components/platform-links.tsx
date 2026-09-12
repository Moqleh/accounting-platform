import Link from 'next/link';
import { BookOpen, CircleHelp, Compass, Globe2, ShieldCheck, FileCheck2, Database, Mail } from 'lucide-react';
import { platformInfo } from '@/lib/platform-info';
import styles from './platform-info.module.css';

const icons = [BookOpen, Compass, Globe2, CircleHelp, ShieldCheck, Database, FileCheck2, Mail];
export function PlatformLinks({ ar, compact = false }: { ar: boolean; compact?: boolean }) {
  return <nav className={compact ? styles.compact : styles.links} aria-label={ar ? 'عن المنصة والمساعدة' : 'Platform information and help'}>
    {Object.entries(platformInfo).map(([slug, page], index) => {
      const Icon = icons[index];
      return <Link key={slug} href={`/information/${slug}/${ar ? '' : '?lang=en'}`}><Icon size={20} aria-hidden="true"/><span>{ar ? page.ar : page.en}</span></Link>;
    })}
  </nav>;
}
