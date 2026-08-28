# 04 — Design tokens

**Nocturne** design system: desaturated dark background, blurple accent used as a line and a mark (never as a large fill), Inter, 8px radius, 0.7× density (compact on purpose). The original stylesheet is in `design/styles.css`; below is what the app needs.

## Colors

```
--bg           #161826   app background
--surface      #232532   cards and fields
--tile         #292b31   block inside a card (previews, "impact on save")
--text         #e9e9ed   primary text
--muted        #9397ab   secondary text (neutral-500)
--dim          #75798c   tertiary text / labels (neutral-600)
--line         #3f424d   hairline, borders (neutral-800)
--accent       #9184d9   accent (lines, outlines, projected values)
```

Accent ramp (use these steps, not ad hoc `color-mix`):
`100 #f5f4ff · 200 #e7e5fe · 300 #d2cefd · 400 #b5abfc · 500 #968ae0 · 600 #796cbf · 700 #5d5294 · 800 #423a6a · 900 #2b2741`

Neutral ramp:
`100 #f3f5fe · 200 #e4e7f5 · 300 #cfd3e5 · 400 #b2b6ca · 500 #9397ab · 600 #75798c · 700 #595d6c · 800 #3f424d · 900 #292b31`

Auxiliary ramp (used for "commitments" in charts): `500 #9690c9 · 600 #7972a9 · 700 #5c5783`

**Semantic colors** (defined in OKLCH at the same lightness/chroma as the accent, so they don't clash with the palette):

```
--pos   oklch(0.74 0.11 158)   inflows, within limit, good news
--warn  oklch(0.78 0.12 78)    warning, near limit, rising invoice
--neg   oklch(0.70 0.13 22)    limit exceeded, error
```

Usage rules: accent for **projected values and actions**; green only for inflows and confirmations; amber and red only when there's a number to justify them. Never color a whole card. Never use pure black or white.

## Typography

Inter 400/500/600 (Google Fonts). Never go above 500 in titles — hierarchy is size and spacing, not weight.

| Use | Size / weight | Note |
| --- | --- | --- |
| Screen title | 19px / 500, `letter-spacing -.02em` | `.ttl` in the mockup |
| Large KPI | 29–38px / 500, `-.02em`, tabular | net worth, balance |
| Medium KPI | 19–24px / 500, tabular | month rows |
| Body | 15px / 400 | system base |
| Data row | 12.5px / 400, tabular | tables and lists |
| Label (kicker) | 10.5px / 400, `letter-spacing .1em`, uppercase, `--dim` | `.lbl` |
| Nav group header | 9.5px / 500, `.14em`, uppercase, `#595d6c` | |
| Micro-note | 11–11.5px / 400, `--dim` or `--muted` | |

**Every monetary number uses `font-variant-numeric: tabular-nums`.** Values use a monospace font (`ui-monospace`) in tables and installment lists, as in the mockup.

Formatting: `Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })`. In KPIs, omit cents when `.00` (R$ 15.000); in tables and forms, always show cents (R$ 59,90). Explicit sign only where there's ambiguity (`+ R$ 15.000`, `− R$ 350`).

## Spacing and shape

```
spacing scale: 2.8 · 5.6 · 8.4 · 11.2 · 16.8 · 22.4 px   (0.7× scale)
in practice:   14px gap between cards, 14–16px padding in a card, 22–26px on a page
radius:        4px (sm) · 8px (md, default) · 14px (lg, modal)
hairline:      1px var(--line)  |  elevation: box-shadow 0 0 0 1px var(--line)
modal shadow:  0 0 0 1px #595d6c, 0 16px 40px rgba(0,0,0,.65)
```

No stacked shadows: in dark mode, elevation is border + ambient darkness.

## Components

| Component | Spec |
| --- | --- |
| **Primary button** | Outline: `1px solid var(--accent)`, accent-colored text, transparent background. Hover: `accent 12%` background. Active: `accent 22%`. Never filled. `padding 7px 12px`, 8px radius, 12.5px/500 |
| **Secondary button** | `var(--line)` border, `--text` text, hover `text 7%` |
| **Ghost** | Accent-colored text only |
| **Field** | `--surface` background, `var(--line)` border, 8px radius, min height 36px, 14px. Focus: accent border. 12px label above, `text 70%` color |
| **Segmented control** | Hairline box, options separated by a hairline; selected gets `inset 0 0 0 1px var(--accent)` and accent-colored text |
| **Checkbox/radio** | 16px, hairline border; checked = accent with `inset 0 0 0 4px var(--bg)` |
| **Card** | `--surface`, 8px radius, `padding 14px 16px`, `gap 8–14px`, flex column |
| **Tag** | 11px, `padding 3px 9px`, 6px radius. `Realizado` = neutral-800 background; `Confirmado` = accent-800 background / accent-100 text; `Projetado` = accent outline |
| **Filter chip** | 11px, `#292b31` background, `--muted` color; active = `accent 16%` background, `#d2cefd` text, with an `×` |
| **Table** | 14px, 11px uppercase header `text 60%`, row rule that **fades at the edges** (48px on each side) — the system's signature detail. Row hover: `text 4%` |
| **Progress bar** | 6–10px track, 3–5px radius, `#292b31` background; fill in the accent color (or `--warn`/`--neg` by severity) |
| **Inline alert** | `--surface` card, 15–17px icon colored by severity, 500-weight title + `--muted` explanation, small buttons (11.5px, `padding 5px 10px`) |
| **Modal** | 410–460px wide (form) or 880px (invoice), 14px radius, `padding 26px 30px 30px`, `neutral-900 50%` backdrop |
| **Tooltip** | Label with `border-bottom: 1px dotted #595d6c` and `cursor: help`; 240px box, `#292b31` background, 11px, appears on hover. **Conceptual explanations live here, not in screen copy** (team decision) |

**Keyboard focus**: `outline: 2px solid var(--accent); outline-offset: 2px` on everything interactive. Never the browser's blue ring. Disabled: `opacity .45`.

## Icons

Phosphor regular, via `@phosphor-icons/react`. Sizes: 15px in nav, 16–17px in lists and alerts, 20–26px in detail headers and empty states. Names used in the mockup: `squares-four, calendar-check, list-dashes, bank, credit-card, chart-line-up, piggy-bank, calendar-dots, calendar-blank, arrows-clockwise, gauge, chart-pie-slice, gear-six, flask, plus, magnifying-glass, caret-left, caret-right, caret-down, arrow-right, arrow-down, arrow-down-left, arrows-left-right, warning-circle, warning-octagon, check-circle, info, lightbulb, trend-up, shopping-cart, coffee, monitor-play, laptop, house, wifi-high, barbell, fork-knife, car, confetti, graduation-cap, users-three, hand-heart, airplane-tilt, shield-check, dots-three-vertical, funnel, download-simple, sliders-horizontal, x, trash, bicycle, arrow-clockwise, dots-three-circle`.

## Charts

No library in the mockup; reimplement with whatever you prefer (Recharts, visx) while keeping these conventions:

- **Bars** for overviews and month-to-month comparison (the team's choice over lines): realized is solid (`--accent` for the current month, `#3f424d`/`#5d5294` for previous ones), **projected = outline only** `inset 0 0 0 1px var(--accent)` with an `accent 10%` fill.
- **Donut** for category composition: 168px diameter, 100px hole, total in the center; slices on the accent ramp in descending order (`#968ae0 → #796cbf → #5d5294 → #423a6a → #3f424d`), commitments in `#7972a9`. Legend with value and % next to it, never inside the chart.
- **Line** only for the before/after comparison in the simulation: without the purchase solid `#75798c`, with the purchase dashed (`4 4`) in the accent color.
- **Stacked bar** 8–10px for the composition of a single total (month expenses, available vs. reserved).
- Scale: always normalize by the series' **largest value** (the biggest bar = 100%); never let a bar overflow its container.
- No axes, no grid, no floating legend. Value label above the bar, month below, 10.5px in `--dim`.
- No entrance animation on financial data (it gives the impression the value is changing).

## Copy

pt-BR, real Brazilian financial terminology: Receitas, Despesas, Aportes, Sobra em caixa, Taxa de poupança, Saldo disponível, Livre para gastar, Fatura, Parcelas, Limite, Comprometido, Disponível, Patrimônio líquido, Porquinhos, Recorrências, Compromissos, Projetado, Confirmado, Realizado.

Sober, neutral tone: number first, explanation second, action last. No emoji, no exclamation marks, no gamification, no judgment ("você gastou demais" → "R$ 400 acima do limite de alimentação, 3º mês seguido").
