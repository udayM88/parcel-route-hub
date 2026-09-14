# Make the CMS formatting toolbar follow editing smoothly

## Scope
- Improve the shared rich-text editor used for blog posts, landing pages, FAQs, and courier-partner content.
- Keep publishing, saving, preview, uploads, permissions, and existing content unchanged.
- Do not add CMS access to roles that do not currently have it; Admin and CMS Editor views will inherit the same shared behavior automatically.

## Changes
- Keep the formatting toolbar visible while the user scrolls through long editor content, but constrain it to the editor so it never floats over unrelated sections.
- Position the toolbar below the existing sticky admin header with a small consistent gap, preventing header or content overlap.
- Add a subtle “attached while scrolling” visual state with smooth transitions, semantic background/border/shadow tokens, and no layout jump.
- Preserve selection and editor focus while using formatting controls, including links, colors, alignment, lists, undo/redo, and media insertion.
- Make active formatting states update from the current cursor or selected text so the toolbar remains connected to what the user is editing.
- Improve narrow-screen toolbar behavior with compact spacing, reliable touch targets, and contained horizontal scrolling or wrapping so controls stay reachable without widening the page.
- Ensure the editable content starts below the toolbar and that headings, paragraphs, code blocks, and images never slide underneath it.

## Technical details
- Update the shared `RichTextEditor` rather than duplicating logic in each CMS page.
- Use an editor-bound sticky toolbar with the admin header height as its offset; use a small scroll sentinel/observer only for the elevated stuck state.
- Keep positioning in normal document flow and use CSS transitions that respect `prefers-reduced-motion`.
- Use existing Button, Select, Dialog, and semantic design tokens; do not change TipTap extensions or stored HTML.
- Clean up toolbar interaction semantics where needed so color choices and icon controls preserve the active selection and remain keyboard accessible.

## Verification
- Test new and existing blog, page, FAQ, and partner editors with short and long content.
- Verify scrolling from above the editor, through the editor, and past its end; confirm the toolbar enters and exits smoothly without covering content.
- Verify caret movement, multi-line text selection, formatting state changes, links, undo/redo, and image/media blocks.
- Check phone, tablet portrait/landscape, and desktop widths for clipping, page overflow, toolbar overlap, and usable controls.
- Confirm the same shared behavior under Super Admin and CMS Editor access; note that Operations currently has no CMS editor route, so its permissions remain unchanged.
- Confirm preview, draft save, publish/update, and the project build still work.
