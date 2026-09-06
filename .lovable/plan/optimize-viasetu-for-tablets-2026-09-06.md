# Optimize ViaSetu for tablets

## Scope
- Improve layouts for common tablet widths (768–1024px) without changing the existing mobile or desktop visual direction.
- Prioritize shared navigation and the main customer, booking, business, support, and admin experiences.

## Changes
- Replace the crowded tablet public header with a compact menu treatment and one device-appropriate app-store badge; keep the full navigation for desktop.
- Adjust tablet content widths, columns, spacing, and text sizing so sections use the available screen instead of retaining narrow phone layouts or oversized desktop spacing.
- Keep booking actions reachable and stable, with comfortable tablet tap targets and no overlap with navigation.
- Make logged-in customer navigation usable on tablets instead of leaving the interface without either desktop navigation or the mobile bottom navigation.
- Improve admin and business screens at tablet widths by collapsing wide navigation where needed and allowing dense tables/filters to scroll or wrap safely.
- Add focused tablet-only styling through existing shared layouts and semantic design tokens.

## Verification
- Check the landing, business landing, login, customer home, booking, support, and admin shell at representative portrait and landscape tablet sizes.
- Confirm there is no horizontal page overflow, clipped text, overlapping controls, or inaccessible navigation.
- Confirm phone and desktop layouts remain unchanged and the project finishes with a successful build.

## Technical details
- Use the existing React, Tailwind, shadcn controls, routing, and design tokens.
- Favor shared breakpoint fixes over page-by-page overrides, using `md` for tablet layout and reserving `lg` for full desktop navigation where appropriate.
