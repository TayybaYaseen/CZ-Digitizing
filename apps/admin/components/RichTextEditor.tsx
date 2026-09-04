'use client';

import Image from '@tiptap/extension-image';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { ReactNode } from 'react';
import { apiFetch } from '@/lib/api-client';

// Tips/Blog/About body-content editor (spec §6 component-test requirement: "formatting, embedded
// images"). No rich-text editor existed anywhere in the repo before this — Tiptap chosen as the
// lightest headless option that satisfies that requirement.
export function RichTextEditor({ value, onChange, accessToken }: { value: string; onChange: (html: string) => void; accessToken: string | null }) {
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: { attributes: { class: 'prose prose-sm max-w-none min-h-[200px] focus:outline-none px-3 py-2' } },
    immediatelyRender: false,
  });

  async function insertImage(file: File) {
    if (!editor || !accessToken) return;
    const form = new FormData();
    form.append('file', file);
    const { url } = await apiFetch<{ url: string }>('/api/uploads/images', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
    editor.chain().focus().setImage({ src: url }).run();
  }

  if (!editor) return null;

  return (
    <div className="rounded-field border border-gray-300 bg-white" data-testid="rich-text-editor">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 px-2 py-1.5">
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold">
          B
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic">
          I
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bulleted list">
          •
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list">
          1.
        </ToolbarButton>
        <label className="cursor-pointer rounded px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100" title="Insert image">
          Image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void insertImage(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-semibold ${active ? 'bg-gold-100 text-gold-700' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {children}
    </button>
  );
}
