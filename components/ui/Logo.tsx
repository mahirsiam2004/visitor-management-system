import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
}

const sizeMap = {
  xs:  48,
  sm:  64,
  md:  90,
  lg:  120,
  xl:  150,
  '2xl': 180,
}

export default function Logo({ size = 'md', className }: LogoProps) {
  const dim = sizeMap[size]

  return (
    <Image
      src="/logo.png"
      alt="SecureEntry"
      width={dim}
      height={dim}
      className={cn('object-contain', className)}
      priority
    />
  )
}
