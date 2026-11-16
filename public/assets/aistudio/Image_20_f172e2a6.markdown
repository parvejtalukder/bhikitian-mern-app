---
name: Academic Editorial Modern
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#747686'
  outline-variant: '#c4c5d7'
  surface-tint: '#2151da'
  primary: '#0037b0'
  on-primary: '#ffffff'
  primary-container: '#1d4ed8'
  on-primary-container: '#cad3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#505f7b'
  on-secondary: '#ffffff'
  secondary-container: '#ceddff'
  on-secondary-container: '#52617e'
  tertiary: '#6b3700'
  on-tertiary: '#ffffff'
  tertiary-container: '#8d4b00'
  on-tertiary-container: '#ffcba3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001551'
  on-primary-fixed-variant: '#0039b5'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#b8c7e7'
  on-secondary-fixed: '#0b1b34'
  on-secondary-fixed-variant: '#384762'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
  surface-parchment: '#fdfbf7'
  surface-muted: '#f8fafc'
  border-subtle: '#e2e8f0'
  navy-deep: '#0f1f38'
  navy-banner: '#183358'
  status-review: '#e0f2fe'
  status-review-text: '#0369a1'
  status-payment: '#fef3c7'
  status-payment-text: '#92400e'
  status-waived: '#ede9fe'
  status-waived-text: '#6d28d9'
  status-published: '#dcfce7'
  status-published-text: '#15803d'
  dark-bg-base: '#0a0f1d'
  dark-bg-surface: '#111827'
  dark-border: '#1e293b'
  dark-text-base: '#f8fafc'
  dark-text-muted: '#94a3b8'
typography:
  display-hero:
    fontFamily: Merriweather
    fontSize: 2.75rem
    fontWeight: '700'
    lineHeight: '1.25'
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Merriweather
    fontSize: 1.875rem
    fontWeight: '700'
    lineHeight: '1.3'
  headline-lg:
    fontFamily: Merriweather
    fontSize: 2.125rem
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Merriweather
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: '1.35'
  headline-md:
    fontFamily: Merriweather
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: '1.4'
  headline-sm:
    fontFamily: Merriweather
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: '1.75'
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: '1.65'
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: 0.04em
  caption:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes an authoritative, scholarly, yet accessible bilingual open encyclopedia. Drawing inspiration from institutional archives, classic editorial broadsheets, and modern knowledge repositories, it pairs academic dignity with the clarity and speed of contemporary web utilities.

### Personality & Values
- **Scholarly & Trustworthy:** Fact-first presentation, calm authority, and high typographic rigor.
- **Bilingual & Inclusive:** Natural support for English and Bengali scripts with balanced x-heights and baseline alignment.
- **Utilitarian Elegance:** Clear separation between content curation chrome (MediaWiki actions, namespaces, review queues) and immersive long-form reading.
- **Distraction-Free:** Generous editorial margins, disciplined contrast ratios, and purposeful metadata styling.

### Aesthetic Movement: Contemporary Classical Editorial
The aesthetic marries literary serif headline craft with systematic humanist interface ergonomics. Crisp 1px structural dividing rules replace heavy drop shadows, recalling traditional library bindings and reference volumes.

## Colors

The palette is rooted in institutional navy and ink tones, balanced against clean parchment and warm neutral backdrops.

### Primary & Accent Roles
- **Primary (`#1d4ed8`):** Academic cobalt blue used for verified article links, primary interactive states, and active navigation indicators.
- **Secondary (`#0f1f38`):** Deep scholastic navy applied to banner heads, structural navigation headers, and primary editorial iconography.
- **Tertiary (`#d97706`):** Warm amber used selectively for partner highlights, citation notices, and secondary callouts.
- **Neutral (`#0f172a`):** Crisp slate-black providing high-legibility body contrast on light surfaces.

### Reading Modes
- **Light Mode:** Defaults to `#fdfbf7` for immersive editorial body reading surfaces, paired with `#f8fafc` for outer margins, infobox containers, and MediaWiki tab rails. Borders rely on `#e2e8f0`.
- **Dark Reading Mode:** Maps root canvases to deep midnight `#0a0f1d`, elevated surface containers to `#111827`, subtle dividers to `#1e293b`, and primary typography to `#f8fafc` and `#94a3b8`.

## Typography

The type system balances the scholarly warmth of **Merriweather** with the pragmatic precision of **Inter**.

### Usage Guidelines
- **Article Titles & Section Headings:** Use Merriweather for H1-H3 headers. Always ensure headings over 24px reduce tracking slightly (`-0.015em` to `-0.02em`) to maintain cohesion.
- **Reading Line Length & Measure:** Article body text strictly enforces a line measure between 65 and 75 characters (`max-w-3xl`) to minimize eye fatigue during extended research.
- **Interface & Metadata:** Inter governs site navigation, MediaWiki action tabs, infobox key-value pairs, table of contents links, and editorial badges.
- **Bengali Script Support:** Ensure fallbacks provide compatible Bengali font rendering with balanced vertical leading to accommodate high and low diacritics.

## Layout & Spacing

The layout model is anchored by a structured 12-column grid for overview pages, landing portals, and administrative views, shifting into an asymmetric 3-column layout for encyclopedia articles:

- **Left Rail (Desktop, ~240px):** Table of contents, namespace markers, and language switcher.
- **Center Canvas (`max-w-3xl` / 768px):** Uncluttered reading column with strict paragraph and heading rhythms.
- **Right Rail (Desktop, ~300px):** Metadata infoboxes, reference blocks, and related entries.

### Breakpoint Adjustments
- **Mobile (< 768px):** Collapses to a single-column layout. The table of contents tucks into a sticky top drawer. Gutter drops to `1rem` and section margins to `1rem`.
- **Tablet (768px - 1024px):** Dual-column layout; infobox nests under the title, while the article body and table of contents share primary screen real estate.
- **Desktop (> 1024px):** Full three-tier layout with fixed gutters (`1.5rem`) and auto-centered canvas up to 1340px total container width.

## Elevation & Depth

This design system avoids heavy, blurred drop shadows in favor of flat architectural discipline and delicate low-contrast outlines:

- **Baseline Level (Level 0):** Document canvas at `#fdfbf7` or `#f8fafc`. No border or shadow.
- **Card & Inset Containers (Level 1):** Flat `#ffffff` or container tint with a crisp `1px solid #e2e8f0` outline. Zero shadow.
- **Popovers, Dropdowns, and Autocomplete (Level 2):** Elevated menus use a precise structural shadow tinted in navy: `0 4px 12px -2px rgba(15, 31, 56, 0.08), 0 2px 6px -1px rgba(15, 31, 56, 0.04)`, bounded by a `1px solid #cbd5e1` outline.
- **Modal Dialogs (Level 3):** Administrative review and edit conflict modals use `0 20px 25px -5px rgba(15, 31, 56, 0.12), 0 8px 10px -6px rgba(15, 31, 56, 0.06)` paired with a soft midnight backdrop overlay (`rgba(15, 23, 42, 0.6)`).

## Shapes

The design system maintains a **Soft** shape geometry (`roundedness: 1`), conveying institutional stability without feeling cold or brutalist:

- **Standard Buttons & Inputs:** `0.25rem` (4px) border radius.
- **Containers, Cards, & Infoboxes:** `0.5rem` (8px) border radius (`rounded-lg`).
- **Hero Blocks & Feature Panels:** `0.75rem` (12px) border radius (`rounded-xl`).
- **Status Badges & Category Tags:** Fully pill-shaped (`rounded-full`) to differentiate metadata chips from actionable square-corner buttons.

## Components

### 1. Navigation & MediaWiki Action Tabs
- **Site Header:** Anchored by the globe jigsaw puzzle identity, bilingual edition toggle, and quick global search.
- **Article Action Bar:** Clean horizontal tab list with items for *Read*, *View Source*, *History*, *Discussion*, and *Tools*. The active tab features a `2px solid #1d4ed8` bottom accent line and `#0f1f38` bold text; inactive tabs use `#64748b` hoverable text with transparent borders.

### 2. Search Bar
- Input field styled with an inset magnifying glass icon, a crisp `1px solid #cbd5e1` outline, `0.25rem` radius, and an accompanying direct action button group (*Open article* vs. *Search all articles*).

### 3. Buttons
- **Primary:** Deep navy background (`#0f1f38`), white text, `0.25rem` radius, padding `0.625rem 1.25rem`. Hover state shifts to `#1d4ed8`.
- **Secondary / Ghost:** Transparent surface with `1px solid #cbd5e1`, `#1e293b` text. Hover shifts to `#f1f5f9`.
- **Accent Action:** Muted amber (`#d8b66f` or `#d97706`), dark text for partnership or donation CTAs.

### 4. Article Infobox
- Right-aligned structured card with a solid `#0f1f38` header bar, crisp `1px solid #e2e8f0` body grid, alternating zebra key-value rows (`#ffffff` and `#f8fafc`), and high-density 13px Inter text.

### 5. Multi-State Submission Badges
- **Review:** Background `#e0f2fe`, text `#0369a1`, border `#bae6fd`.
- **Awaiting Payment:** Background `#fef3c7`, text `#92400e`, border `#fde68a`.
- **Fee Waived:** Background `#ede9fe`, text `#6d28d9`, border `#ddd6fe`.
- **Published:** Background `#dcfce7`, text `#15803d`, border `#bbf7d0`.
- All badges use `rounded-full`, uppercase `0.6875rem` text with `0.05em` letter tracking, and `0.25rem 0.625rem` padding.

### 6. Advertisement Label Badge
- Unobtrusive micro-header placed strictly above sponsored placements: `0.6875rem` uppercase label in `#94a3b8` ("Advertisement — Served by a third-party provider; not endorsed by Bhikitia").

### 7. Editorial Admin Queue Table
- High-density tabular layout with sticky headers (`#f8fafc`), `1px solid #e2e8f0` horizontal row dividers, monospaced revision hashes, and status badge columns. Hover row highlight at `#f1f5f9`.