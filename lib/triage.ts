import { FaultCategory, FaultSeverity } from '@prisma/client';
import { askForJson, activeProvider } from '@/lib/ai';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * AI triage for cycle fault reports.
 *
 * A rider reporting a fault types whatever they notice ("back brake feels
 * spongy") and may attach a photo. Staff need that as structured, sortable
 * work: what kind of fault, how urgent, and above all whether the cycle is
 * still safe for the next person to ride.
 *
 * When a photo is attached it is sent to Claude alongside the text — a cracked
 * frame or a shredded tyre is far easier to judge from the image than from a
 * rider's description of it.
 *
 * If no API key is configured, or the call fails for any reason, a keyword
 * classifier takes over so a reported fault is never left untriaged.
 */

export interface TriageResult {
  category: FaultCategory;
  severity: FaultSeverity;
  safeToRide: boolean;
  summary: string;
  /** Which provider produced this, or 'fallback' for the offline classifier. */
  source: 'anthropic' | 'groq' | 'fallback';
  /** True when a fault photo was included in the assessment. */
  usedPhoto: boolean;
}

/** Queue ordering weight (higher = service sooner). */
export const SEVERITY_RANK: Record<FaultSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const SYSTEM_PROMPT = `You triage bicycle fault reports for the shared-cycle fleet at the Isha Yoga Center campus. Riders are visitors and residents, not mechanics, so reports are informal and often vague.

Classify each report so maintenance staff can prioritise it.

Severity guidance:
- CRITICAL: the cycle could injure the rider now — brake failure, steering/fork/frame cracks, a wheel about to come off.
- HIGH: will strand or endanger the rider soon — chain slipping badly, flat tyre, pedal coming loose.
- MEDIUM: degrades the ride but is not dangerous — gears skipping, seat slipping, squealing brakes that still work.
- LOW: cosmetic or comfort — bell broken, scratched paint, dirty frame.

safeToRide must be false whenever a rider could plausibly be hurt before staff reach the cycle. When a report is ambiguous about brakes, steering or the frame, err toward unsafe.

When a photo is provided, judge what you can actually see in it and let it override a vague description — a rider who writes "small issue" over a photo of a cracked frame is reporting a critical fault. If the photo is unclear or shows nothing relevant, rely on the text.

The summary is read by staff scanning a work queue: one short factual phrase, max 12 words, no pleasantries.`;

const TRIAGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    category: {
      type: 'string' as const,
      enum: Object.values(FaultCategory),
    },
    severity: {
      type: 'string' as const,
      enum: Object.values(FaultSeverity),
    },
    safeToRide: { type: 'boolean' as const },
    summary: { type: 'string' as const },
  },
  required: ['category', 'severity', 'safeToRide', 'summary'],
  additionalProperties: false,
};

/**
 * Keyword triage used when Claude is unavailable. Deliberately conservative:
 * anything touching brakes, steering or the frame is treated as unsafe, since
 * wrongly clearing a dangerous cycle costs far more than wrongly pulling a
 * sound one.
 */
export function fallbackTriage(notes: string): TriageResult {
  const text = notes.toLowerCase();
  const has = (...words: string[]) => words.some((w) => text.includes(w));

  let category: FaultCategory = FaultCategory.OTHER;
  if (has('brake', 'braking', 'stop')) category = FaultCategory.BRAKES;
  else if (has('chain', 'gear', 'pedal', 'sprocket')) category = FaultCategory.CHAIN;
  else if (has('tyre', 'tire', 'puncture', 'flat', 'wheel', 'spoke'))
    category = FaultCategory.TYRE;
  else if (has('frame', 'crack', 'bent', 'handle', 'fork', 'seat', 'saddle'))
    category = FaultCategory.FRAME;
  else if (has('light', 'battery', 'bell', 'horn')) category = FaultCategory.ELECTRICAL;

  const dangerous = has(
    'brake',
    'crack',
    'bent',
    'fork',
    'wobble',
    'loose',
    'came off',
    'fell off',
    'snapped'
  );
  const stranding = has('flat', 'puncture', 'chain', 'slipping', 'gear');

  let severity: FaultSeverity = FaultSeverity.MEDIUM;
  if (dangerous) severity = FaultSeverity.CRITICAL;
  else if (stranding) severity = FaultSeverity.HIGH;
  else if (has('bell', 'scratch', 'paint', 'dirty', 'rust')) severity = FaultSeverity.LOW;

  const trimmed = notes.trim();
  return {
    category,
    severity,
    safeToRide: !dangerous,
    summary: trimmed.length > 70 ? `${trimmed.slice(0, 67)}...` : trimmed,
    source: 'fallback',
    usedPhoto: false,
  };
}

const PHOTO_MEDIA_TYPES: Record<string, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Load a saved fault photo for the vision call. Photos live under public/ and
 * are referenced by public path (e.g. /uploads/faults/123.jpg).
 */
async function loadPhoto(photoUrl: string) {
  // Reject anything that escapes the uploads directory.
  if (!photoUrl.startsWith('/uploads/')) return null;

  const mediaType = PHOTO_MEDIA_TYPES[path.extname(photoUrl).toLowerCase()];
  if (!mediaType) return null;

  const abs = path.join(process.cwd(), 'public', photoUrl);
  if (!abs.startsWith(path.join(process.cwd(), 'public', 'uploads'))) return null;

  try {
    const buffer = await readFile(abs);
    // The API caps image payloads; skip anything implausibly large.
    if (buffer.byteLength > 5 * 1024 * 1024) return null;
    return { mediaType, data: buffer.toString('base64') };
  } catch {
    return null;
  }
}

/**
 * Triage a fault report. Never throws — on any failure it returns the fallback
 * classification so a reported fault is never silently dropped.
 */
export async function triageFaultReport(
  issueNotes: string,
  qrCode: string,
  issuePhotoUrl?: string | null
): Promise<TriageResult> {
  const notes = issueNotes?.trim();
  if (!notes) {
    return {
      category: FaultCategory.OTHER,
      severity: FaultSeverity.MEDIUM,
      safeToRide: false,
      summary: 'Fault reported without details',
      source: 'fallback',
      usedPhoto: false,
    };
  }

  if (activeProvider() === 'none') {
    return fallbackTriage(notes);
  }

  const photo = issuePhotoUrl ? await loadPhoto(issuePhotoUrl) : null;

  const { data, provider } = await askForJson<Omit<TriageResult, 'source' | 'usedPhoto'>>({
    system: SYSTEM_PROMPT,
    schemaName: 'fault_triage',
    schema: TRIAGE_SCHEMA,
    image: photo,
    maxTokens: 1000,
    user: `Cycle ${qrCode}. Rider's fault report:\n\n"${notes}"${
      photo ? '\n\nThe rider also attached the photo above.' : ''
    }`,
  });

  // Trust but verify: a schema-valid reply can still carry a value we do not
  // recognise if the schema and the Prisma enums ever drift apart.
  if (
    !data ||
    !Object.values(FaultCategory).includes(data.category) ||
    !Object.values(FaultSeverity).includes(data.severity) ||
    typeof data.safeToRide !== 'boolean'
  ) {
    return fallbackTriage(notes);
  }

  return {
    ...data,
    source: provider === 'none' ? 'fallback' : provider,
    usedPhoto: Boolean(photo),
  };
}
