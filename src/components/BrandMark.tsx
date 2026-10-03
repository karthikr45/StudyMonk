/* eslint-disable @next/next/no-img-element */

// Display the supplied logo without stretching or changing its artwork.
// The StudyMonk product name remains in the surrounding wordmark.
export default function BrandMark({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/brand/mk-tech-monk.png"
      alt="MK Tech Monk logo"
      width={Math.round(size * 384 / 154)}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: Math.round(size * 384 / 154), height: size }}
    />
  );
}
