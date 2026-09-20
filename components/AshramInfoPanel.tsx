'use client';

import { useMemo, useState } from 'react';
import { Clock, MapPin, Phone, BookOpen, AlertCircle, ExternalLink } from 'lucide-react';
import {
  ASHRAM_FACTS,
  CAMPUS_LANDMARKS,
  type Fact,
} from '@/lib/ashram-knowledge';

/**
 * Ashram information: timings, places, who to call, and the practical
 * questions people arrive with.
 *
 * This panel reads `lib/ashram-knowledge.ts` — the same hand-maintained file
 * the assistant answers from — rather than carrying its own copy of the facts.
 * One file to correct when a timing changes, and the tab can never disagree
 * with what Sahayata AI says about the same question.
 *
 * It inherits that file's honesty rule, which is the important part:
 *
 *   confirmed   → stated plainly
 *   unverified  → shown, but visibly marked as unchecked
 *   PLACEHOLDER → not rendered at all
 *
 * So a section can legitimately be empty. An empty section says "ask at the
 * desk", which is the correct answer when nobody has confirmed the timing —
 * far better than a confident number that sends someone across the campus for
 * a darshan that finished an hour ago.
 */

type SectionId = 'timings' | 'places' | 'contacts' | 'guidelines';

/**
 * Which facts belong under which heading.
 *
 * Matched on `topic`, so adding a fact to the knowledge file puts it in front
 * of visitors without touching this component. A topic named here but absent
 * from the file is simply skipped; a fact in the file that no section claims
 * falls through to "More", so nothing a maintainer writes goes unseen.
 */
const SECTION_TOPICS: Record<SectionId, string[]> = {
  timings: [
    'Temple timings',
    'Daily rituals and offerings',
    'Milk offering',
    'Ekadasi and other special days',
    'Dining timings',
    'Programmes offered',
  ],
  places: [
    'Shuttle and golf cart service',
    'Shuttle pick-up and drop-off points',
    'Accommodation',
    'How to reach the Isha Yoga Center',
  ],
  contacts: ['Address and phone number', 'Arrival and registration'],
  guidelines: ['Dress code and conduct', 'Accessibility'],
};

const SECTIONS: { id: SectionId; label: string; Icon: typeof Clock; blurb: string }[] = [
  { id: 'timings', label: 'Timings', Icon: Clock, blurb: 'When things open and happen' },
  { id: 'places', label: 'Places', Icon: MapPin, blurb: 'Getting here and getting around' },
  { id: 'contacts', label: 'Contacts', Icon: Phone, blurb: 'Who to call, and where to report' },
  { id: 'guidelines', label: 'Guidelines', Icon: BookOpen, blurb: 'What to wear, what to know' },
];

/** Phone numbers should be tappable; the rest of a detail stays plain text. */
function renderDetail(detail: string) {
  const parts = detail.split(/(\+91[\d\s]{8,})/g);
  return parts.map((part, i) =>
    /^\+91[\d\s]{8,}$/.test(part) ? (
      <a key={i} href={`tel:${part.replace(/\s/g, '')}`} className="yc-info-tel">
        {part.trim()}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function FactCard({ fact }: { fact: Fact }) {
  return (
    <li className="yc-info-card">
      <div className="flex items-start justify-between gap-2.5">
        <p className="yc-title yc-title-sm">{fact.topic}</p>
        {fact.verified === 'unverified' && (
          <span className="yc-info-chip" title="Not yet confirmed on site">
            Not checked
          </span>
        )}
      </div>
      <p className="yc-body-sm mt-1.5">{renderDetail(fact.detail)}</p>
      {fact.verified === 'unverified' && (
        <p className="yc-info-caveat">
          <AlertCircle className="w-3 h-3 shrink-0 mt-[1px]" aria-hidden />
          <span>
            These times have not been confirmed on site. Check at the Main Gate
            desk before relying on them.
          </span>
        </p>
      )}
      {fact.verified === 'confirmed' && fact.checked && (
        <p className="yc-meta mt-1.5">Checked {fact.checked}</p>
      )}
    </li>
  );
}

export default function AshramInfoPanel() {
  const [section, setSection] = useState<SectionId>('timings');

  // PLACEHOLDER facts never reach a visitor — same rule the assistant follows.
  const visible = useMemo(() => ASHRAM_FACTS.filter((f) => f.verified !== 'PLACEHOLDER'), []);

  const claimed = useMemo(
    () => new Set(Object.values(SECTION_TOPICS).flat()),
    []
  );

  const factsFor = (id: SectionId) => {
    const topics = SECTION_TOPICS[id];
    const own = visible.filter((f) => topics.includes(f.topic));
    // Anything the maintainer added but no section claims surfaces under
    // Guidelines rather than vanishing.
    if (id === 'guidelines') {
      return [...own, ...visible.filter((f) => !claimed.has(f.topic))];
    }
    return own;
  };

  const shown = factsFor(section);
  const active = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="yc-sheet yc-info-panel">
      <div className="px-4 pt-3.5 pb-2">
        <p className="yc-eyebrow">Ashram Info</p>
        <h2 className="yc-title yc-title-md mt-1.5">{active.blurb}</h2>
      </div>

      <div className="yc-info-tabs" role="tablist" aria-label="Information sections">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`yc-info-tab${section === id ? ' is-active' : ''}`}
          >
            <Icon className="w-[0.95rem] h-[0.95rem]" strokeWidth={section === id ? 2.4 : 1.9} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="yc-info-body">
        {shown.length > 0 ? (
          <ul className="yc-info-list">
            {shown.map((f) => (
              <FactCard key={f.topic} fact={f} />
            ))}
          </ul>
        ) : (
          /* Not an error. Nobody has confirmed anything in this section yet,
             and inventing an answer is the one thing this feature must not do. */
          <div className="yc-info-empty">
            <AlertCircle className="w-5 h-5 opacity-45" aria-hidden />
            <p className="yc-body-sm mt-2.5">
              Nothing here has been confirmed yet.
            </p>
            <p className="yc-meta mt-1.5 max-w-[17rem]">
              Rather than show times nobody has checked, Sahayata leaves this
              empty. The desk at Main Gate has the current answer.
            </p>
            <a href="tel:+918300083111" className="yc-btn-ghost mt-3.5">
              <Phone className="w-3.5 h-3.5" aria-hidden />
              Call the enquiry desk
            </a>
          </div>
        )}

        {section === 'places' && (
          <div className="yc-info-landmarks">
            <p className="yc-eyebrow">Landmarks on campus</p>
            <p className="yc-meta mt-1 mb-2">
              The cycle stands, which double as directions.
            </p>
            <ul>
              {CAMPUS_LANDMARKS.map((l) => (
                <li key={l}>
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-[2px] opacity-55" aria-hidden />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="yc-info-foot">
          <ExternalLink className="w-3 h-3 shrink-0 mt-[2px] opacity-55" aria-hidden />
          <span>
            Timings change seasonally and on special days. The noticeboards on
            site are always the final word.
          </span>
        </p>
      </div>
    </div>
  );
}
