import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StudyMonk — CBSE Offline Study',
  description: 'CBSE study platform for after-school learning and study groups.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
