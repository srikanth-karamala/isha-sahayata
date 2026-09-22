import { ImageOff, ShieldAlert, Wrench } from 'lucide-react';
import type { FaultCategory, FaultSeverity } from '@prisma/client';

/**
 * Cycles out of service, newest report on top.
 *
 * Built to read like the Lost & Found board rather than the fleet charts it
 * replaced: a count, then a list of rows, each one a thing a person can pick up
 * and act on. The Overview previously carried a demand chart and a row of hub
 * capacity bars, which on a quiet campus showed a flat line at zero and six
 * bars all reading "Healthy" — true, and of no use to anyone deciding what to
 * do next.
 *
 * Severity is a chip with a text label and a weighted dot, never colour alone:
 * the red, amber and green sit about 1.7 ΔE apart under deuteranopia, which is
 * indistinguishable to a red-green colourblind reader. Do not simplify these
 * back to coloured text.
 */

export interface RepairRow {
  id: string;
  qrCode: string;
  summary: string | null;
  notes: string | null;
  severity: FaultSeverity | null;
  category: FaultCategory | null;
  safeToRide: boolean | null;
  photoUrl: string | null;
  hubName: string | null;
  reportedAt: Date | string;
}

function whenLabel(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = (Date.now() - d.getTime()) / 3_600_000;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

const SEVERITY_CHIP: Record<FaultSeverity, string> = {
  CRITICAL: 's-chip-crit',
  HIGH: 's-chip-crit',
  MEDIUM: 's-chip-warn',
  LOW: 's-chip-neutral',
};

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  // No photo: a small camera-off glyph rather than an empty grey square, which
  // read as a broken image. Keeps rows aligned down the column either way.
  if (!src)
    return (
      <div className="s-thumb s-thumb-empty" aria-hidden>
        <ImageOff className="w-4 h-4" />
      </div>
    );
  return (
    // Opens full size: the photo is often the only thing that shows what is
    // actually wrong with the cycle.
    <a href={src} target="_blank" rel="noreferrer" className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="s-thumb" />
    </a>
  );
}

export default function RepairQueue({ rows }: { rows: RepairRow[] }) {
  const unsafe = rows.filter((r) => r.safeToRide === false).length;

  return (
    <section className="s-card p-4">
      <h3 className="s-h3 mb-0.5 flex items-center gap-1.5">
        <Wrench className="w-3.5 h-3.5" aria-hidden />
        In repair
        <span className="s-count">{rows.length}</span>
      </h3>
      <p className="s-meta mb-2">
        {rows.length === 0
          ? 'Newest report first.'
          : unsafe > 0
            ? `Newest report first · ${unsafe} unsafe to ride.`
            : 'Newest report first.'}
      </p>

      {rows.length === 0 ? (
        <p className="s-body">
          Nothing in repair. Every cycle on the campus is in service.
        </p>
      ) : (
        <ul className="s-feed">
          {rows.map((row) => (
            <li key={row.id} className="s-feed-row">
              <div className="flex gap-3">
                <Thumb src={row.photoUrl} alt={`Fault on cycle ${row.qrCode}`} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="s-h3 min-w-0">{row.qrCode}</p>
                    <span className="s-meta shrink-0">
                      {whenLabel(row.reportedAt)}
                    </span>
                  </div>

                  <p className="s-meta mt-1 flex items-center gap-2 flex-wrap">
                    {row.severity && (
                      <span className={`s-chip ${SEVERITY_CHIP[row.severity]}`}>
                        {row.severity}
                      </span>
                    )}
                    {row.safeToRide === false && (
                      <span className="s-chip s-chip-crit">
                        <ShieldAlert className="w-3 h-3" aria-hidden />
                        Unsafe to ride
                      </span>
                    )}
                    {row.category && <span>{row.category}</span>}
                    {row.hubName && <span>· {row.hubName}</span>}
                  </p>

                  {/* The rider's own words, when the summary is a condensed
                      restatement of them rather than new information. */}
                  {row.summary && <p className="s-body-sm mt-1">{row.summary}</p>}
                  {row.notes && row.notes !== row.summary && (
                    <p className="s-meta mt-1">{row.notes}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
