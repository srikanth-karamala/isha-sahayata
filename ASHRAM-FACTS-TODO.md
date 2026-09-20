# Ashram facts still to confirm

Printed from `lib/ashram-knowledge.ts` on 20 September 2026.

Two of fifteen entries reach visitors today — the address (confirmed) and the
temple timings (shown with a caveat). The rest are `PLACEHOLDER` and are
not shown at all — the Info tab and Sahayata AI both stay silent on them, which
is correct but thin. Confirming one is a five-minute job at the right
noticeboard, and each becomes visible the moment it is marked.

**How to mark one confirmed**, in `lib/ashram-knowledge.ts`:

1. Replace `detail` with the answer, in plain sentences.
2. Set `verified: 'confirmed'`.
3. Set `checked` to today's date, e.g. `checked: '2026-09-21'`.

No other change is needed. The Info tab reads this file directly.

---

## At the Main Gate desk / reception

- [ ] **How to reach the Isha Yoga Center**
      Confirm the distance and usual travel time from Coimbatore city and from Coimbatore airport and railway station, and which public buses serve the centre. Note the last bus of the day, which is what a late arrival actually needs.

- [ ] **Arrival and registration**
      Confirm where a visitor reports on arrival, what identification is required, and whether day visitors need to register at all.

- [ ] **Shuttle and golf cart service**
      Confirm the hours the shuttles and carts run, the route they follow, the fare if any, and whether one can be requested or only boarded at a stop.

- [ ] **Shuttle pick-up and drop-off points**
      Confirm the list of stops and roughly how long the shuttle takes between them. The cycle stands in CAMPUS_LANDMARKS below are already accurate and can be named as landmarks alongside these.

- [ ] **Dress code and conduct**
      Confirm what visitors are asked to wear, particularly for entering the temples, and any restriction on photography, footwear or phones.

- [ ] **Accessibility**
      Confirm what assistance exists for visitors who cannot walk long distances, including wheelchair availability and step-free routes, and how to arrange it.

- [ ] **Accommodation**
      Confirm what accommodation exists for visitors, how it is booked, and the check-in and check-out times.

- [ ] **Programmes offered**
      Confirm which programmes are currently open to visitors, their duration, and how to register. Programme schedules change month to month — record the month this was checked, and prefer pointing visitors at the desk over listing dates that will expire.

## At the Temple noticeboards (Dhyanalinga + Linga Bhairavi)

- [~] **Temple timings**  _(shown now, but unchecked — verify and upgrade)_
      The Dhyanalinga is generally open from about 6:00am to 8:00pm. The Linga Bhairavi temple is generally open about 6:30am to 1:20pm and again from about 4:20pm to 8:20pm. Both can change seasonally and on special days.

- [ ] **Daily rituals and offerings**
      Confirm the names and times of the daily offerings at each temple, and whether visitors may attend each one or only observe.

- [ ] **Milk offering**
      Confirm the timing of the milk offering, where a visitor obtains the offering, and any restriction on who may participate.

- [ ] **Ekadasi and other special days**
      Confirm which days in the current month are observed differently, and how timings change on them. Ekadasi falls twice a lunar month, so this needs a date-aware answer rather than a fixed one — if it cannot be kept current, leave it PLACEHOLDER so the assistant refers people to the desk instead.

## At the Biksha Hall noticeboard

- [ ] **Dining timings**
      Confirm the serving windows for each meal at Biksha Hall, and whether day visitors eat there or elsewhere.

---

## Already done

- [x] **Address and phone number** — confirmed 20 September 2026.

## Deliberately left alone

**Ekadasi** moves with the lunar month and the **programme schedule** changes
monthly. If neither can be kept current, leaving them as placeholders is the
right answer: the assistant then refers people to the desk instead of quoting
a date that has expired.
