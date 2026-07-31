'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

function Btn({ editor, cmd, active, label }: { editor: Editor; cmd: () => void; active: boolean; label: string }) {
  return (
    <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd(); }}
      className={`h-8 min-w-8 rounded-md px-2 text-sm font-semibold ${active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
      {label}
    </button>
  );
}

/**
 * Lightweight rich-text answer editor (open-source TipTap). Emits sanitized-on-
 * server HTML. Used for LONG written answers so students can format their work.
 */
export default function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: value || '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'prose-answer min-h-[150px] px-4 py-3 outline-none' } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return <div className="input min-h-[180px]" />;

  const words = editor.getText().trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 p-1.5">
        <Btn editor={editor} label="B" active={editor.isActive('bold')} cmd={() => editor.chain().focus().toggleBold().run()} />
        <Btn editor={editor} label="I" active={editor.isActive('italic')} cmd={() => editor.chain().focus().toggleItalic().run()} />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn editor={editor} label="H2" active={editor.isActive('heading', { level: 2 })} cmd={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Btn editor={editor} label="• List" active={editor.isActive('bulletList')} cmd={() => editor.chain().focus().toggleBulletList().run()} />
        <Btn editor={editor} label="1. List" active={editor.isActive('orderedList')} cmd={() => editor.chain().focus().toggleOrderedList().run()} />
        <Btn editor={editor} label="❝" active={editor.isActive('blockquote')} cmd={() => editor.chain().focus().toggleBlockquote().run()} />
        <Btn editor={editor} label="</>" active={editor.isActive('codeBlock')} cmd={() => editor.chain().focus().toggleCodeBlock().run()} />
      </div>
      <EditorContent editor={editor} />
      <div className="border-t border-slate-100 px-4 py-1.5 text-xs text-slate-400">{words} words</div>
    </div>
  );
}
