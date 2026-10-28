import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered, Quote,
  Link as LinkIcon, Image as ImageIcon, Undo, Redo, Code, Code2,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Minus, RemoveFormatting,
  Highlighter, Link2Off,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  onInsertImage?: () => Promise<string | null>;
}

const COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];

export default function RichTextEditor({ value, onChange, onInsertImage }: Props) {
  const onChangeRef = useRef(onChange);
  const [, refreshToolbar] = useState(0);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'underline text-primary', rel: 'noopener' } }),
      Image,
      Placeholder.configure({ placeholder: 'Write your content...' }),
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML()),
    onSelectionUpdate: () => refreshToolbar((revision) => revision + 1),
    editorProps: { attributes: { class: 'cms-content' } },
  }, []);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkNewTab, setLinkNewTab] = useState(true);
  const [colorOpen, setColorOpen] = useState(false);
  const colorSelectionRef = useRef<{ from: number; to: number } | null>(null);

  // Sync external value changes (e.g., initial DB load) without ever wiping
  // the user's in-progress edits on re-renders or window focus changes.
  const lastExternalRef = useRef<string>(value || '');
  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming === lastExternalRef.current) return;
    lastExternalRef.current = incoming;
    if (editor.isFocused) return;
    if (incoming === editor.getHTML()) return;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  const openLink = () => {
    const prev = (editor.getAttributes('link').href as string) || '';
    setLinkUrl(prev);
    setLinkNewTab(((editor.getAttributes('link').target as string) || '_blank') === '_blank');
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!linkUrl) {
      editor.chain().focus().unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const attrs: Record<string, string | null> = { href: linkUrl, target: linkNewTab ? '_blank' : null };
    if (editor.state.selection.empty) {
      editor.chain().focus().insertContent(`<a href="${linkUrl}"${linkNewTab ? ' target="_blank" rel="noopener"' : ''}>${linkUrl}</a>`).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink(attrs as { href: string }).run();
    }
    setLinkOpen(false);
  };

  const insertImage = async () => {
    if (onInsertImage) {
      const url = await onInsertImage();
      if (url) editor.chain().focus().setImage({ src: url }).run();
    } else {
      const url = window.prompt('Image URL');
      if (url) editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const ToolBtn = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
    <Button type="button" title={title} aria-label={title} aria-pressed={active} variant={active ? 'default' : 'ghost'} size="sm"
      onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="h-9 w-9 shrink-0 p-0 sm:h-8 sm:w-8">
      {children}
    </Button>
  );

  const Sep = () => <div className="w-px h-6 bg-border mx-0.5" />;

  const headingValue = (() => {
    for (let l = 1; l <= 6; l++) if (editor.isActive('heading', { level: l })) return `h${l}`;
    return 'p';
  })();

  const setHeading = (v: string) => {
    if (v === 'p') editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  };

  const handleColorOpenChange = (open: boolean) => {
    if (open) {
      const { from, to } = editor.state.selection;
      colorSelectionRef.current = { from, to };
    }
    setColorOpen(open);
  };

  const applyTextColor = (color?: string) => {
    const saved = colorSelectionRef.current ?? {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    let { from, to } = saved;

    // With only a caret, apply the colour to the current text block so users
    // get immediate feedback instead of affecting only text typed afterwards.
    if (from === to) {
      const resolved = editor.state.doc.resolve(from);
      if (resolved.depth > 0) {
        from = resolved.start(resolved.depth);
        to = resolved.end(resolved.depth);
      }
    }

    const chain = editor.chain().focus();
    if (to > from) chain.setTextSelection({ from, to });
    if (color) chain.setColor(color);
    else chain.unsetColor();
    if (saved.from === saved.to) chain.setTextSelection(saved.from);
    chain.run();

    colorSelectionRef.current = null;
    setColorOpen(false);
  };

  return (
    <div className="border rounded-md bg-background cms-editor isolate overflow-hidden">
      <div className="cms-toolbar relative z-10 border-b bg-background">
       <div className="cms-toolbar-scroll flex items-center gap-0.5 p-2">
        <Select value={headingValue} onValueChange={setHeading}>
          <SelectTrigger className="h-9 w-[112px] shrink-0 text-xs sm:h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Paragraph</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
            <SelectItem value="h4">Heading 4</SelectItem>
            <SelectItem value="h5">Heading 5</SelectItem>
            <SelectItem value="h6">Heading 6</SelectItem>
          </SelectContent>
        </Select>
        <Sep />
        <ToolBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-4 w-4" /></ToolBtn>
        <Sep />
        <Popover open={colorOpen} onOpenChange={handleColorOpenChange}>
          <PopoverTrigger asChild>
            <Button type="button" title="Text color" aria-label="Text color" variant="ghost" size="sm"
              onMouseDown={(event) => event.preventDefault()} className="h-9 w-9 shrink-0 p-0 sm:h-8 sm:w-8">
              <span className="relative flex h-6 w-5 items-center justify-center text-sm font-semibold leading-none">
                A
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full border border-black/10"
                  style={{ background: (editor.getAttributes('textStyle').color as string) || '#000000' }} />
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-auto max-w-[calc(100vw-2rem)] flex-wrap gap-1 p-2">
            {COLORS.map((color) => (
              <Button key={color} type="button" variant="ghost" size="icon" aria-label={`Use ${color} text color`}
                className="h-8 w-8 p-1" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextColor(color)}>
                <span className="h-full w-full rounded-sm border" style={{ background: color }} />
              </Button>
            ))}
            <Button type="button" variant="ghost" size="icon" aria-label="Clear text color" className="h-8 w-8"
              onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextColor()}>×</Button>
          </PopoverContent>
        </Popover>
        <ToolBtn title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter className="h-4 w-4" /></ToolBtn>
        <Sep />
        <ToolBtn title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolBtn>
        <Sep />
        <ToolBtn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></ToolBtn>
        <Sep />
        <ToolBtn title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Link" active={editor.isActive('link')} onClick={openLink}><LinkIcon className="h-4 w-4" /></ToolBtn>
        {editor.isActive('link') && (
          <ToolBtn title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}><Link2Off className="h-4 w-4" /></ToolBtn>
        )}
        <ToolBtn title="Insert image" onClick={insertImage}><ImageIcon className="h-4 w-4" /></ToolBtn>
        <ToolBtn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="h-4 w-4" /></ToolBtn>
        <div className="ml-auto flex gap-1">
          <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></ToolBtn>
          <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></ToolBtn>
        </div>
       </div>
      </div>
      <div className="cms-editor-scroll" aria-label="Blog content writing area">
        <EditorContent editor={editor} />
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Insert link</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="link-url">URL</Label>
              <Input id="link-url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }} autoFocus />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="link-newtab" checked={linkNewTab} onCheckedChange={(v) => setLinkNewTab(!!v)} />
              <Label htmlFor="link-newtab" className="cursor-pointer">Open in new tab</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button onClick={applyLink}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
