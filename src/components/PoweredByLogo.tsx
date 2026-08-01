'use client';

import { useState } from 'react';

// Shows the MK Tech Monk logo from /public/mktechmonk-logo.png; if the file
// isn't present yet, falls back to a styled wordmark.
export default function PoweredByLogo() {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="font-semibold text-gradient">MK Tech Monk</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/mktechmonk-logo.png"
      alt="MK Tech Monk"
      className="h-6 w-auto"
      onError={() => setFailed(true)}
    />
  );
}
