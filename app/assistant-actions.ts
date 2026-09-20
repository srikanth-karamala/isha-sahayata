'use server';

import { prisma } from '@/lib/prisma';
import {
  haversineMeters,
  compassDirection,
  formatDistance,
  walkingMinutes,
  isPlausibleCampusPosition,
} from '@/lib/geo';
import { askForText, providerLabel, type ChatTurn } from '@/lib/ai';
import {
  CAMPUS_LANDMARKS,
  knowledgeIsEmpty,
  hasUnverifiedFacts,
  publicFacts,
} from '@/lib/ashram-knowledge';

/**
 * Sahayata AI — the visitor assistant behind the floating button.
 *
 * The design constraint that shapes everything here: a visitor asking "when
 * does the temple open" will act on the answer. So the assistant is allowed to
 * state only two kinds of thing — live data read from this database, and facts
 * a human has confirmed in lib/ashram-knowledge.ts — and is instructed to say
 * it does not know about anything else rather than fill the gap from training
 * data. A model's recollection of a timing is not a source.
 */

/** Cap on turns kept, so a long session cannot grow the prompt without bound. */
const MAX_HISTORY = 8;

/**
 * Live campus state, so "where can I get a cycle" has a real answer.
 *
 * When the rider has shared their location, each stand is given with its
 * distance and compass direction from them. Without it the assistant could
 * only ever answer "which stand has cycles", never "which one should I walk
 * to" — and the coordinates to answer that were already in the database,
 * surveyed, just never passed to the model.
 */
async function liveContext(rawAt: [number, number] | null): Promise<string> {
  const hubs = await prisma.hub.findMany({
    include: { cycles: { select: { status: true } } },
    orderBy: { name: 'asc' },
  });

  // A position hundreds of kilometres away is a bad fix, not a long walk: a
  // desktop browser or a phone on Wi-Fi will report a city-level location
  // derived from an IP address, with full confidence. Distances computed from
  // one are arithmetically right and practically nonsense, so the position is
  // dropped rather than quoted.
  const at = isPlausibleCampusPosition(rawAt) ? rawAt : null;

  const withDistance = hubs.map((hub) => {
    const available = hub.cycles.filter((c) => c.status === 'AVAILABLE').length;
    const pos: [number, number] | null =
      hub.latitude != null && hub.longitude != null
        ? [hub.latitude, hub.longitude]
        : null;
    const metres = at && pos ? haversineMeters(at, pos) : null;
    return { hub, available, pos, metres };
  });

  // Nearest first when we know where they are: the order itself is information
  // the model can lean on, and it keeps the closest option in the first line.
  if (at) withDistance.sort((a, b) => (a.metres ?? 1e9) - (b.metres ?? 1e9));

  const lines = withDistance.map(({ hub, available, pos, metres }) => {
    const base = `- ${hub.name}: ${available} cycle(s) ready now, ${hub.capacity} docks total`;
    if (metres == null || !pos) return base;
    return `${base}, ${formatDistance(metres)} ${compassDirection(at!, pos)} of the visitor (about ${walkingMinutes(metres)} min walk)`;
  });

  // The handed-in items themselves, not just a count. A count cannot answer
  // "has anyone turned in a blue bottle?", which is the question, and it gives
  // a photo nothing to be compared against.
  const found = await prisma.lostFoundItem.findMany({
    where: { kind: 'FOUND', status: 'OPEN' },
    include: { hub: true },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  // Telling the model the fix was discarded — rather than just withholding
  // the distances — stops it inventing one or claiming not to know where
  // anything is. It knows where the stands are; it only lacks the visitor.
  const positionNote =
    !at && rawAt
      ? 'NOTE: the device reported a location far from the campus, so it was ignored. You do NOT know where the visitor is. Do not quote any distance or direction, and do not guess one. If they ask how far something is, say you cannot tell where they are and suggest they turn on location, or name the landmark it is next to.'
      : null;

  return [
    at
      ? 'LIVE CYCLE AVAILABILITY (read just now, nearest to the visitor first):'
      : 'LIVE CYCLE AVAILABILITY (read from the database just now):',
    ...lines,
    ...(positionNote ? ['', positionNote] : []),
    '',
    `LOST & FOUND — ${found.length} item(s) handed in and waiting to be claimed:`,
    ...(found.length
      ? found.map(
          (f) =>
            `- ${f.title ?? f.description} (${f.hub?.name ?? f.placeNote ?? 'place not given'})`
        )
      : ['  (nothing waiting)']),
    'Claims are made at the Main Gate desk. Never give out the finder\'s phone number.',
    '',
    at
      ? "The visitor's location is known, so distances above are from where they are standing. Quote them."
      : 'The visitor has not shared their location, so no distances are available. Do not guess how far anything is; name the stand and let them find it on the map.',
  ].join('\n');
}

/**
 * What this particular rider has going on, when we know who is asking.
 *
 * The assistant had no idea who it was talking to, so the questions a rider
 * most naturally asks — "am I still on a ride?", "did anyone find my bottle?"
 * — were the ones it could not answer, while the answers sat in the database
 * already computed. Match suggestions especially: they are scored and stored
 * when a report is filed, and until now a rider had to go and find them in
 * the Lost & Found tab.
 *
 * Only ever this rider's own rows. Nothing here reaches anyone else, and the
 * finder's phone number is deliberately not included — staff arrange the
 * handover, so the app does not hand out a stranger's number.
 */
async function riderContext(userId: string | null): Promise<string> {
  if (!userId) {
    return 'THE VISITOR: not identified yet, so you know nothing about their own rides or reports. If they ask about "my cycle" or "my lost item", say you need them to scan or report first.';
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  if (!user) return 'THE VISITOR: not identified yet.';

  const [active, lastRide, reports] = await Promise.all([
    prisma.ride.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { cycle: true },
    }),
    prisma.ride.findFirst({
      where: { userId, status: 'COMPLETED' },
      orderBy: { endedAt: 'desc' },
      include: { cycle: true },
    }),
    prisma.lostFoundItem.findMany({
      where: { reportedById: userId, status: 'OPEN' },
      include: {
        hub: true,
        matchesAsSource: {
          where: { dismissed: false, target: { status: 'OPEN' } },
          orderBy: { score: 'desc' },
          take: 2,
          include: { target: { include: { hub: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const lines: string[] = [`THE VISITOR: ${user.name}.`];

  if (active) {
    const mins = Math.max(
      1,
      Math.round((Date.now() - active.startedAt.getTime()) / 60000)
    );
    lines.push(
      `- ON A RIDE RIGHT NOW: cycle ${active.qrCode}, started ${mins} minute(s) ago. They can drop it at any hub with a free dock.`
    );
  } else if (lastRide) {
    lines.push(
      `- Not riding. Their last ride was on ${lastRide.qrCode}, ended ${whenWords(lastRide.endedAt)}.`
    );
  } else {
    lines.push('- They have not taken a ride yet.');
  }

  if (reports.length === 0) {
    lines.push('- They have no open lost & found reports.');
  } else {
    for (const r of reports) {
      const what = r.title ?? r.description;
      const where = r.hub?.name ?? r.placeNote ?? 'place not given';
      lines.push(
        `- Their ${r.kind === 'LOST' ? 'LOST' : 'HANDED-IN'} report: "${what}" (${where}, ${whenWords(r.createdAt)}).`
      );
      for (const m of r.matchesAsSource) {
        const other = m.target;
        lines.push(
          `    POSSIBLE MATCH ${m.score}%: "${other.title ?? other.description}" ${
            other.kind === 'FOUND' ? 'handed in at' : 'reported lost at'
          } ${other.hub?.name ?? other.placeNote ?? 'an unrecorded place'}. Reason: ${m.reasoning} — tell them to claim it at the Main Gate desk; do not give out the other person's phone number.`
        );
      }
      if (r.matchesAsSource.length === 0) {
        lines.push('    No likely match yet.');
      }
    }
  }

  return lines.join('\n');
}

/** Coarse "when" for the prompt — the model phrases it, this just bounds it. */
function whenWords(date: Date | null): string {
  if (!date) return 'recently';
  const hours = (Date.now() - date.getTime()) / 3_600_000;
  if (hours < 1) return 'in the last hour';
  if (hours < 24) return `about ${Math.round(hours)} hour(s) ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} day(s) ago`;
}

function buildSystemPrompt(live: string, rider: string): string {
  const facts = publicFacts();

  // Facts carry their standing into the prompt. A confirmed fact and one that
  // nobody has checked on site are both worth saying, but the visitor has to
  // be able to tell them apart — so the model is told which is which rather
  // than being handed a flat list it would state with equal confidence.
  const factBlock = facts.length
    ? facts
        .map(
          (f) =>
            `- [${f.verified === 'confirmed' ? 'CONFIRMED' : 'NOT CHECKED ON SITE'}] ${f.topic}: ${f.detail}`
        )
        .join('\n')
    : '(No ashram timings or services have been confirmed yet. You do not know any of them.)';

  return `You are Sahayata AI, the assistant inside the Isha Sahayata app, which serves the campus cycle-share and lost & found.

You help visitors with getting around the campus.

WHAT YOU KNOW
${factBlock}

CAMPUS LANDMARKS (these are the cycle stands, and double as directions):
${CAMPUS_LANDMARKS.map((l) => `- ${l}`).join('\n')}

${live}

${rider}

HOW TO ANSWER
- Answer only from the information above. It is the whole of what you know.
- If you are asked about a timing, a ritual, a cart route, a pick-up point or
  any service that does not appear above, say plainly that you do not have that
  information and suggest asking at the Main Gate desk. Do NOT guess, and do
  NOT answer from general knowledge about Isha or the Isha Yoga Center — an
  outdated timing sends someone across the campus for nothing.
- A fact marked CONFIRMED you may state plainly. A fact marked NOT CHECKED ON
  SITE you should still give — it is the best answer available — but always
  add, in the same breath, that it has not been confirmed and that the desk at
  Main Gate has the current times. Never present one as though it were the
  other, and never drop the caveat to sound more helpful.
- Never invent a time, a phone number, a route or a place name.
- Be brief: two or three sentences is usually right. This is read on a phone.
- Be warm and plain-spoken. No flowery language.
- For cycle availability, quote the live numbers above; they are current.
- When a distance is given, use it: "Spanda Hall, about 250 m north-east, 3 minutes" is
  the useful answer. Weigh it against availability — a stand two minutes further with
  fifteen cycles beats the nearest one with a single cycle.
- Do NOT give turn-by-turn walking directions. You know where things are, not which
  paths connect them; name the landmark and the direction and let the map do the rest.
- Answer "my cycle", "my ride" and "my lost item" from THE VISITOR block above, which
  is about the person asking. If a possible match is listed for something they lost,
  volunteer it — that is the whole point of the feature, and they should not have to
  go looking for it. Send them to the Main Gate desk to claim, and never read out the
  other person's phone number.
- When a photo is attached, read it and say what you see in plain words, then use it:
  if it is something they have lost or found, describe the object the way a finder
  would write it down — colour, material, markings, any number or writing on it — and
  compare it against the handed-in items listed above. A number painted on an object
  identifies it better than any description, so always read one out if it is there.
  If nothing above matches, say so and point them at reporting it properly.
- If your answer is about one particular cycle stand, end the whole reply with a tag
  on its own line: [[hub:Exact Stand Name]], spelled exactly as listed above. The app
  strips the tag and shows that stand on the map, so the visitor sees where you mean
  instead of hunting for it. One tag at most, and only when a single stand is the
  answer — not when you are listing several.
- Reply in the language the visitor used. Tamil gets Tamil, Hindi gets Hindi, English
  gets English; match their script too. Visitors here do not all speak English, and an
  answer in a language someone cannot read is the same as no answer. Place names stay
  as they are written above — "Biksha Hall" is what the sign says, so transliterate it
  rather than translating it, or they will be looking for a building that is not
  signposted.`;
}

export interface AssistantReply {
  reply: string;
  /** Stand the answer is about, for the map to show. Null when none. */
  hubName: string | null;
  provider: string;
  /** True when no facts are confirmed yet — the UI warns staff, not visitors. */
  unconfigured: boolean;
  /** True when some facts on offer are still unchecked on site. */
  unverified: boolean;
}

/**
 * Whether any ashram fact has been confirmed, asked before the first question.
 *
 * askAssistant already returns this, but only once an answer comes back. The
 * warning needs to be up before that: the visitor most likely to be misled is
 * the one still deciding what to ask, looking at an opener like "How do I get
 * to Biksha Hall?" with no sign that timings are unavailable.
 */
export async function assistantNeedsSetup(): Promise<{
  empty: boolean;
  unverified: boolean;
}> {
  return { empty: knowledgeIsEmpty(), unverified: hasUnverifiedFacts() };
}

export async function askAssistant(
  history: ChatTurn[],
  /** The rider's position, when they have shared it. */
  at?: [number, number] | null,
  /** Who is asking, so "my cycle" and "my lost bottle" can be answered. */
  userId?: string | null,
  /** A photo attached to the newest question, as a data URL from the camera. */
  photoDataUrl?: string | null
): Promise<AssistantReply> {
  const trimmed = history.slice(-MAX_HISTORY);
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== 'user') {
    throw new Error('Ask a question to begin.');
  }

  const [live, rider] = await Promise.all([
    liveContext(at ?? null),
    riderContext(userId ?? null),
  ]);
  // A photo turns this into a vision call. Parsed here rather than stored:
  // a picture asked about in chat is a question, not a report, and keeping it
  // out of the Upload table means nothing is retained that nobody filed.
  let image: { mediaType: string; data: string } | null = null;
  if (photoDataUrl) {
    const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(photoDataUrl);
    if (m) image = { mediaType: m[1].toLowerCase(), data: m[2] };
  }

  const { data, provider } = await askForText(
    buildSystemPrompt(live, rider),
    trimmed,
    600,
    image
  );

  if (!data) {
    return {
      reply:
        'I cannot reach the assistant just now. For anything urgent, the desk at Main Gate can help.',
      hubName: null,
      provider: providerLabel('none'),
      unconfigured: knowledgeIsEmpty(),
      unverified: hasUnverifiedFacts(),
    };
  }

  // Pull the tag off the end. It is an instruction to the app, not something
  // the visitor should read, so it never reaches the transcript.
  const tag = /\[\[hub:([^\]]+)\]\]/i.exec(data);
  const reply = data.replace(/\[\[hub:[^\]]+\]\]/gi, '').trim();

  return {
    reply,
    hubName: tag ? tag[1].trim() : null,
    provider: providerLabel(provider),
    unconfigured: knowledgeIsEmpty(),
    unverified: hasUnverifiedFacts(),
  };
}
