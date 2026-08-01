/* eslint-disable @next/next/no-img-element */

// The official StudyMonk app-icon (teal tile + meditating monk). Use anywhere
// the logo chip appears. `size` is the rendered pixel size.
export default function BrandMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/app-icon.svg"
      alt="StudyMonk"
      width={size}
      height={size}
      className={`rounded-xl ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
