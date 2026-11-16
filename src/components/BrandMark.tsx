const BHIKITIA_MARK = '/assets/Bhikitia.png';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 34, className = '' }: BrandMarkProps) {
  return (
    <img
      src={BHIKITIA_MARK}
      alt="Bhikitia"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      decoding="async"
      className={`shrink-0 rounded-lg bg-white object-contain ring-1 ring-black/5 dark:ring-white/10 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
