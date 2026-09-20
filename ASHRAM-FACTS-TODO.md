# Ashram facts — what is still missing

State of `lib/ashram-knowledge.ts` on 20 September 2026: **14 entries, 11 of
them now shown to visitors.** Two are confirmed outright, nine carry the "not
checked" caveat, and three are still placeholders.

Most of the gap was closed from the official Isha website. That is a real
improvement — the Info tab and Sahayata AI went from answering almost nothing
to answering most of what a visitor asks — but a website is not a noticeboard.
Published pages go stale silently; a board is corrected the morning a timing
changes, and it is the board the visitor is standing in front of. So those nine
stay `unverified` until someone checks them on site.

## To upgrade an entry to `confirmed`

In `lib/ashram-knowledge.ts`:

1. Correct `detail` if the board disagrees with what is written.
2. Set `verified: 'confirmed'`.
3. Replace `source` with where you read it, and set `checked` to today.

---

## The three still invisible

- [ ] **Ekadasi and other special days** — _deliberately left._ It moves twice
      a lunar month. A fixed answer would expire; leaving it out makes the
      assistant refer people to the desk, which is correct.
- [ ] **Programmes offered** — _deliberately left._ The schedule changes
      monthly, and a stale programme date is worse than no answer.
- [ ] **Accessibility** — the only genuine gap. What assistance exists for
      visitors who cannot walk far: wheelchair availability, step-free routes,
      and how to arrange either. Programme pages mention substantial walking,
      which is not the same question. **Main Gate reception.**

## Shown, but wanting five minutes at a desk

Each of these is answered well enough to be useful and has one specific hole
the website could not fill.

- [~] **How to reach the centre** — the **last bus of the day** from
      Gandhipuram. It is what a late arrival actually needs.
      _Main Gate desk._
- [~] **Arrival and registration** — whether a **day visitor** needs to
      register at all, and what identification is required. The website is
      clear only about overseas visitors. _Main Gate reception._
- [~] **Temple timings** — whether Linga Bhairavi has a **midday break**. The
      website gives one opening and one closing time; an earlier source
      described two sessions. _Temple noticeboards._
- [~] **Daily rituals and offerings** — the **clock times** for Guru Pooja,
      Nada Aradhana and the aratis, and whether a visitor may take part or
      only observe. The names are known; the times are not.
      _Noticeboard at each temple entrance._
- [~] **Milk offering** — what happens on **ordinary days**. Only Amavasya and
      Purnima are documented. _Temple noticeboard, or the attending volunteer._
- [~] **Shuttle and golf cart service** — the **hours** each route runs, the
      fare if any, and whether a shuttle can be requested or only boarded.
      The routes are known; when they run is not. _The shuttle stand itself._
- [~] **Shuttle pick-up and drop-off points** — roughly **how long** the
      shuttle takes between stops. _Main Gate desk._
- [~] **Dining timings** — whether **day visitors** eat at Bhiksha Hall or
      elsewhere. The sittings are known. _Noticeboard at Bhiksha Hall._
- [~] **Accommodation** — **check-in and check-out times**, which anyone
      planning a stay needs and which are not published. _Reception._

## Done

- [x] **Address and phone number** — confirmed 20 September 2026.
- [x] **Dress code and conduct** — confirmed 20 September 2026. A standing
      published policy rather than a timing, and being turned away at a temple
      entrance for the wrong clothes is a real cost, so it is stated plainly.

---

## One inconsistency worth fixing one day

The official spelling is **Bhiksha Hall**. The cycle stand in
`prisma/seed.ts` is named **Biksha Hall**, and that name reaches the map, the
dock list and the assistant's landmark list. Harmless, but they should agree.
