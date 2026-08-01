'use client';

import 'katex/dist/katex.min.css';
import katex from 'katex';

// Render inline LaTeX written between $…$ (e.g. "Prove $\sqrt5$ is irrational").
// KaTeX output is safe HTML; everything else renders as plain text.
export default function MathText({ children }: { children: string | null | undefined }) {
  const text = children ?? '';
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.length > 2 && p.startsWith('$') && p.endsWith('$')) {
          try {
            const html = katex.renderToString(p.slice(1, -1), { throwOnError: false, output: 'html' });
            return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={i}>{p}</span>;
          }
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
