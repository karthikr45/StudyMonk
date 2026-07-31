import sanitizeHtml from 'sanitize-html';

// Allowlist matching what the RichEditor (TipTap StarterKit) can produce.
// Strips scripts/attributes so stored answers are safe to render back.
export function sanitizeAnswer(html: string | null | undefined): string | null {
  if (html == null) return null;
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });
}
