'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, AlertTriangle, Camera } from 'lucide-react';
import { askAssistant, assistantNeedsSetup } from '@/app/assistant-actions';
import type { ChatTurn } from '@/lib/ai';

/**
 * Sahayata AI — a floating assistant for visitor questions.
 *
 * Opened from a button at the foot of the cycles sheet. It was previously a
 * round trigger in the header, reachable from every tab; the two swapped places
 * so that scanning — the thing a rider opens this app to do — occupies the
 * header slot. The cost is that Report and Lost & Found no longer offer the
 * assistant; if that proves wrong, the header trigger is the thing to restore.
 *
 * The assistant answers only from live app data and facts a human has
 * confirmed in lib/ashram-knowledge.ts; see app/assistant-actions.ts for why.
 * Nothing here should encourage the reader to treat an answer as more
 * authoritative than that, hence the standing footnote about the Main Gate desk.
 */

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read photo'));
    reader.readAsDataURL(file);
  });
}

const OPENERS = [
  'Which stand has cycles right now?',
  'How do I get to Biksha Hall?',
  'What has been handed in today?',
];

export default function AssistantChat({
  open,
  onClose,
  at,
  userId,
  onShowHub,
}: {
  open: boolean;
  onClose: () => void;
  /** Rider position, when shared — lets answers carry distance and direction. */
  at?: [number, number] | null;
  /** Who is asking, so the assistant can answer about their own ride and reports. */
  userId?: string | null;
  /** Called with a stand name when the answer is about one, so the map can show it. */
  onShowHub?: (hubName: string) => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  // A photo attached to the next question. Held in memory only: a picture
  // asked about in chat is a question, not a report, so nothing is stored.
  const [photo, setPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  // Answered by the server, twice over: once when the panel opens, and again
  // with every reply. Whether a fact is confirmed is a server-side question,
  // and lib/ashram-knowledge.ts should not reach the client bundle to answer it.
  const [unconfigured, setUnconfigured] = useState(false);
  // Some facts on offer have not been checked on site. Distinct from the
  // empty state: the assistant can answer, but staff should know the answers
  // are still carrying a caveat.
  const [unverified, setUnverified] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Keep the newest message in view as the conversation grows.
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [turns, busy]);

  useEffect(() => {
    // Only while open: the panel unmounts when closed, so this runs once per
    // opening, which is also when a stale answer would matter.
    if (!open) return;
    let cancelled = false;
    void assistantNeedsSetup()
      .then((needs) => {
        if (cancelled) return;
        setUnconfigured(needs.empty);
        setUnverified(needs.unverified);
      })
      // A failure here is not worth surfacing: the banner is advisory, and
      // askAssistant reports the same flag with the first real answer.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const send = async (text: string) => {
    const question = text.trim();
    // A photo on its own is a question — "what is this?" — so it may be sent
    // with no words, but never an empty message with neither.
    if ((!question && !photo) || busy) return;

    const shown = question || 'What is this?';
    const next: ChatTurn[] = [...turns, { role: 'user', content: shown }];
    const attached = photo;
    setTurns(next);
    setDraft('');
    setPhoto(null);
    setBusy(true);
    try {
      const res = await askAssistant(next, at ?? null, userId ?? null, attached);
      setProvider(res.provider);
      setUnconfigured(res.unconfigured);
      setUnverified(res.unverified);
      // The answer named a stand: put it on the map behind the panel, so it is
      // already selected when the visitor closes the chat.
      if (res.hubName) onShowHub?.(res.hubName);
      setTurns([...next, { role: 'assistant', content: res.reply }]);
    } catch {
      setTurns([
        ...next,
        {
          role: 'assistant',
          content:
            'Something went wrong reaching me. The desk at Main Gate can help in the meantime.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Closed state renders nothing: the trigger is a button at the foot of the
  // cycles sheet (see MainDashboard), so the assistant never floats over the
  // map or covers the imagery credit and the map controls.
  if (!open) return null;

  return (
    <div className="yc-assist-panel" role="dialog" aria-label="Sahayata AI">
      <header className="yc-assist-head">
        <div className="flex items-center gap-2 min-w-0">
          {/* The Sahayata mark rather than a generic sparkle: a sparkle is what
              this app puts beside any AI-written text, so reusing it here left
              the assistant without a mark of its own. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sahayata-mark-64.png"
            alt=""
            aria-hidden="true"
            className="yc-sahayata-mark w-[18px] h-[18px] shrink-0"
          />
          <div className="min-w-0">
            <p className="yc-assist-title">Sahayata AI</p>
            <p className="yc-assist-sub">
              {provider ? `Answered by ${provider}` : 'Campus questions'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="yc-assist-close"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="yc-assist-log" ref={scrollRef}>
        {/* Sits above the log rather than inside the empty-state intro, so it
            stays visible once the conversation starts — the point at which a
            declined answer actually needs explaining. */}
        {unconfigured && (
          <div className="yc-assist-setup" role="status">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              I do not have the ashram timings yet, so I can help with cycles,
              lost &amp; found and finding your way around. For timings, the
              desk at Main Gate is the place to ask.
            </span>
          </div>
        )}

        {!unconfigured && unverified && (
          <div className="yc-assist-setup is-soft" role="status">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              Some of my timings are still being checked, so I will say when
              one is not confirmed. The noticeboards on site are the final
              word.
            </span>
          </div>
        )}

        {turns.length === 0 && (
          <div className="yc-assist-intro">
            <p className="yc-body-sm">
              I can help with getting around the campus. Ask me anything.
            </p>
            <div className="yc-assist-openers">
              {OPENERS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => void send(o)}
                  className="yc-assist-chip"
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div
            key={i}
            className={turn.role === 'user' ? 'yc-assist-you' : 'yc-assist-bot'}
          >
            {turn.content}
          </div>
        ))}

        {busy && <div className="yc-assist-bot yc-assist-typing">Thinking…</div>}
      </div>

      {photo && (
        <div className="yc-assist-attach">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Photo you are about to send" />
          <span className="yc-body-sm flex-1">Photo attached</span>
          <button
            type="button"
            onClick={() => setPhoto(null)}
            className="yc-assist-close"
            aria-label="Remove photo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form
        className="yc-assist-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        {/* Photographing a lost object beats describing it: two people rarely
            use the same words for the same thing, and a number written on it
            is worth more than any description. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              setPhoto(await readFileAsDataUrl(file));
            } catch {
              /* unreadable file: leave the composer as it was */
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="yc-assist-cam"
          aria-label="Attach a photo"
          title="Attach a photo"
        >
          <Camera className="w-4 h-4" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about the campus…"
          className="yc-field is-flex"
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={(!draft.trim() && !photo) || busy}
          className="yc-assist-send"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <p className="yc-assist-foot">
        For anything it cannot answer, the desk at Main Gate can help.
      </p>
    </div>
  );
}
