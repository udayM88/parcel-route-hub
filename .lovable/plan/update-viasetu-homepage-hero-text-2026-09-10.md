# Update ViaSetu Homepage Hero Text

## Goal
Replace the current public landing-page hero copy with the new headings and body content provided by the user.

## Changes
1. Update `src/pages/Landing.tsx` hero section:
   - Set `<h1>` to: **Compare Courier Prices & Book Online in India**
   - Set `<h2>` subtitle to: **Compare Courier Services, Prices & Delivery Times**
   - Add body content line: **Compare → Book → Pickup → Track** (styled as a readable process/step line, using arrows as plain characters)
2. Keep the existing responsive layout, background image, translucent card, CTA buttons, and trust badges unchanged.
3. Preserve the existing teal/dark-on-light brand styling and font stack.
4. Optionally align the `<PageSeo>` title/description with the new H1/H2 messaging.

## Verification
- Confirm the hero renders correctly on mobile, tablet, and desktop viewports.
- Confirm only one H1 exists on the page and the heading hierarchy is correct.
- Confirm no horizontal overflow or text clipping.
- Confirm the build completes successfully.
