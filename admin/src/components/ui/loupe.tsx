import Image from 'next/image';
import { formatNumber } from '@/lib/format';
export function LoupeIcon({ size = 24 }: { size?: number }) {
  return <Image src="/images/loupe.png" width={size} height={size} alt="" className="inline-block shrink-0 object-contain" />;
}
export function LoupeAmount({ amount, signed = false }: { amount: number; signed?: boolean }) {
  return <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums" aria-label={`${signed && amount>0 ? '+' : ''}${amount} loupes`}>
    <LoupeIcon /><span>{signed && amount>0 ? '+' : ''}{formatNumber(amount)}</span>
  </span>;
}
