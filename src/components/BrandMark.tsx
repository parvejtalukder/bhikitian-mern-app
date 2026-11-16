import { useState } from 'react';

const LOCAL_CREST = '/src/assets/images/bhikitia_globe_crest_1794809163188.jpg';
const LIVE_LOGO = 'https://en.bhikitia.org/images/9/97/Bhikitia.png';

export function BrandMark({ size = 34 }: { size?: number }) {
  const [src, setSrc] = useState(LIVE_LOGO);

  return (
    <img
      src={src}
      alt="Bhikitia encyclopedia globe emblem"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => {
        if (src !== LOCAL_CREST) {
          setSrc(LOCAL_CREST);
        }
      }}
      className="rounded-full object-cover border border-[#e2e8f0] dark:border-[#1e293b] bg-[#fdfbf7] shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
