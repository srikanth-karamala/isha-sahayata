# Design system — Isha Sahayata

Every value here is defined in `app/globals.css`. This explains the reasoning,
which the stylesheet cannot: what each token is for, why it is that value, and
which decisions were made deliberately and should not be undone by accident.

**The source of truth is the stylesheet.** If the two disagree, the stylesheet
is right and this file is stale.

---

## Two apps, two systems

The same codebase serves two different jobs, and they look different on
purpose.

| | Rider app | Staff console (`/admin`) |
| --- | --- | --- |
| Read | On a phone, outdoors, one-handed | At a desk, scanned for something needing action |
| Surface | Glass floating over a satellite map | Flat opaque cards |
| Accent | Isha amber `#f5b700` | Operational blue `#1f5fbf` |
| Type | Compact, 11–22px | Larger, more air |
| Scope | `:root` | `.yc-staff` only |

The staff theme is scoped to `.yc-staff` so nothing in it reaches the rider
app. **Blue rather than amber for staff actions** is deliberate: blue reads as
operational, and it leaves Isha amber free to mean "brand" rather than
"button".

---

## Colour — rider app

### Ink

| Token | Value | Used for |
| --- | --- | --- |
| `--ink` | `#1c1917` | Headings, primary text |
| `--ink-2` | `#3f3a34` | Body copy |
| `--muted` | `#6b645c` | Secondary text, captions |
| `--faint` | `#8a8278` | Eyebrows, metadata, timestamps |
| `--secondary-label` | `rgba(28,25,23,0.58)` | Labels over varying backgrounds |

Warm near-blacks, never pure `#000`. The whole palette is warm-shifted to sit
with the Isha cream rather than against it.

### Surfaces

| Token | Value | Used for |
| --- | --- | --- |
| `--paper` | `#f3efe6` | App background |
| `--surface` | `rgba(255,252,246,0.92)` | Translucent cards |
| `--surface-2` | `#ebe4d6` | Inset panels, quiet buttons |
| `--separator` | `rgba(28,25,23,0.12)` | Dividers |
| `--line` | `rgba(28,25,23,0.1)` | Hairlines |

### Brand

| Token | Value | Used for |
| --- | --- | --- |
| `--primary` | `#f5b700` | The yellow cycle. Selected tab, primary button |
| `--primary-dark` | `#ca8a04` | Text on pale amber, caveat text |
| `--primary-light` | `#fde68a` | The assistant's fill — softer than primary |

**Amber is the only product accent.** If something needs to stand out and is
not the brand, it borrows weight or position rather than another hue.

### Status

Red `#d03b3b` for an unsafe cycle. Used once, for the fault verdict a rider
must not miss. Status colours never double as accents.

---

## Colour — staff console

| Token | Value | Role |
| --- | --- | --- |
| `--s-bg` | `#f4f5f7` | Page |
| `--s-surface` | `#ffffff` | Cards |
| `--s-surface-2` | `#f8f9fb` | Inset |
| `--s-ink` | `#14181f` | Headings |
| `--s-ink-2` | `#3d454f` | Body |
| `--s-muted` | `#6b7480` | Secondary |
| `--s-faint` | `#98a1ae` | Metadata |
| `--s-accent` | `#1f5fbf` | Data and actions |
| `--s-accent-soft` | `#eaf1fc` | Accent backgrounds |
| `--s-crit` | `#b3261e` | Needs attention now |
| `--s-warn` | `#8a6100` | Unconfirmed, caution |
| `--s-good` | `#1a7f37` | Resolved, healthy |

Cool greys here, against the rider app's warm ones — a desk tool rather than a
companion. Each status colour has a `-soft` background pair.

---

## Typography

Two families, each with one job.

**`--serif`** — `FedraSerifAStdBook`, falling back to Trirong. Brand moments
only: the app name, the welcome heading, section titles on the Info tab.

> **The licensed Fedra files are not shipped.** `--serif` names the font with
> no `@font-face` and no file, so **Trirong renders everywhere today**. Adding
> the licensed files would upgrade every heading at once, with no code change.

**`--sans`** — the system stack, SF on Apple devices and Mukta as an Indic
fallback. Everything else. Using the platform font means the interface reads
as native rather than as a web page pretending.

### The scale

| Class | Size | Weight | Colour | For |
| --- | --- | --- | --- | --- |
| `.yc-display` | set per use | 400 | `--ink` | Serif. Brand headings |
| `.yc-title-lg` | 22px | 650 | `--ink` | Screen titles |
| `.yc-title-md` | 17px | 650 | `--ink` | Card and panel titles |
| `.yc-title-sm` | 15px | 650 | `--ink` | List item titles |
| `.yc-body` | 15px | 400 | `--ink-2` | Paragraphs |
| `.yc-body-sm` | 13px | 400 | `--muted` | Supporting copy |
| `.yc-meta` | 12px | 500 | `--faint` | Timestamps, counts |
| `.yc-eyebrow` | 11px | 590 | `--faint` | Uppercase section labels, `0.08em` tracking |

Titles use negative tracking (`-0.022em`); it tightens headings at the sizes a
phone uses. Body copy stays at `1.45` line-height, and the onboarding
paragraph is loosened to `1.65` because it is the one block meant to be read
rather than scanned.

### The trap

**`html, body` sets `font-size: 15px`, not 16.** So `1rem` is 15px and every
rem value is about 7% smaller than it reads — `2.75rem` renders as 41px, not
the 44 it looks like. **Touch minimums are written in px for this reason.**
Measuring the live page is what caught it; reading the stylesheet did not.

---

## Layout

### The phone frame

`--phone-w: 390px`, `--phone-h: 844px`. On a desktop the app renders inside a
phone shell; on a phone it fills the screen.

### Vertical order

```
Dynamic Island        floating, z 50
Header                --header-top, glass
Map or spacer         flexible
Bottom stack          the tab panel
Bottom nav            pinned, safe-area aware
```

`--header-top` is `max(0.65rem, safe-area-inset-top) + 3.1rem` — it follows
the notch rather than assuming a fixed inset, and keeps the header clear of
the island above it.

### Full-height panels

Tabs with no map behind them (Ride, Info, Lost & Found) take the whole area:
`.yc-bottom-stack.is-full` grows, and the sheet inside it scrolls. The spacer
that otherwise reserves map height collapses, or both claim `flex: 1` and a
dead band opens above the panel.

### Radii

| Token | Value | For |
| --- | --- | --- |
| `--radius-lg` | 1.5rem | Cards |
| `--radius-xl` | 1.75rem | Sheets |
| `--radius-pill` | 9999px | Buttons, chips, the nav pill |

Generous and consistent — the single strongest cue that this is an iOS-family
interface rather than a web form.

---

## Glass

```
--glass-fill    a 155° warm gradient, 78% → 55% → 70% opacity
--glass-border  rgba(255,255,255,0.62)
--glass-blur    blur(28px) saturate(185%)
--glass-shadow  inset highlight + inset lower edge + 0 10px 36px ambient
```

**Glass floats on the navigation layer; content stays solid.** The header, the
nav and the island are glass. Forms are not: `.yc-sheet-solid` (`#fffcf6`)
exists because glass over satellite imagery makes inputs and labels
unreadable. Over a map, text needs its own opaque ground.

---

## Motion

One curve: **`--spring: cubic-bezier(0.22, 1, 0.36, 1)`**. Everything uses it,
which is most of why the app feels coherent.

| Interaction | Duration |
| --- | --- |
| Colour, background | 0.18s |
| Press (`scale(0.97)`) | 0.22s |
| Tab panel entry | 0.26s |
| Info section entry | 0.22s |
| Nav pill travel | 0.34s |
| Sheet height | 0.35s |

Shorter durations for changes within a surface, longer for changes of
surface. A press is faster than either — it should feel like a response, not
an animation.

**Every animation is disabled under `prefers-reduced-motion`.** Not optional;
motion sensitivity is real and the file respects it throughout.

### Two mechanics worth knowing

**Tab transitions need a keyed wrapper.** Without a `key`, React reuses the
DOM node across tabs and the entry animation never runs again.

**The nav pill is measured, not computed.** One element travels behind the
buttons rather than two cross-fading, and its position is read from the DOM
because the buttons are sized by their labels — "Lost & Found" is far wider
than "Ride" — and re-measured on resize.

### Not done, deliberately

**No horizontal slide between tabs.** It would imply the tabs have an order
and invite a swipe gesture that does not exist.

---

## Touch targets

**44px minimum**, from Apple's and WCAG's shared guidance, written in px
because of the 15px root.

| Control | Height |
| --- | --- |
| Bottom nav item | ~47px |
| Info section tab | 44px |
| Panel close | 44px |
| Report (floating) | 46px |
| Assistant (floating) | 52px |

Known shortfalls, all pre-existing: the map controls (41–43px) and the
"share location" hint (38px). The map controls come partly from MapLibre's own
styling.

---

## Principles

**Say only what is known.** Ashram facts carry a `verified` state, and the UI
renders each differently: confirmed plainly, unverified with a visible "NOT
CHECKED" chip and a caveat, placeholders not at all. An empty section says
"ask at the desk", which is the right answer when nobody has confirmed a
timing, and better than a confident number that sends someone across the
campus for a darshan that finished an hour ago.

**Refuse rather than guess.** When a reported location is implausible the app
hides distances instead of quoting them — it once said a hall 300m away was
441km south-west.

**A control belongs where the need arises.** The assistant floats on every tab
because it answers a question about whatever is on screen. Reporting a fault
does not, so it stays on Cycles. Being convenient somewhere is not the same as
belonging there.

**Secondary means quieter, not smaller.** "Report a broken cycle" reads as
secondary to the assistant through colour and position. It is still a 46px
button, because a target is a physical constraint and hierarchy is not.

**Explain nothing the interface can show.** Two chat banners once named a
source file and addressed "Staff:" — instructions to a maintainer, shown to
visitors. Interface copy speaks to the person reading it.

**Verify on the rendered page.** The 7% rem shortfall, the dock list snapping
while its sheet animated, and the pairings missing in production were all
found by measuring the live page. None were visible in the source.
