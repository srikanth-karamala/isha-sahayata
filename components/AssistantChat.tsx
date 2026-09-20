'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, AlertTriangle } from 'lucide-react';
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

const OPENERS = [
  'Which stand has cycles right now?',
  'How do I get to Biksha Hall?',
  'What has been handed in today?',
];

export default function AssistantChat({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  // Answered by the server, twice over: once when the panel opens, and again
  // with every reply. Whether a fact is confirmed is a server-side question,
  // and lib/ashram-knowledge.ts should not reach the client bundle to answer it.
  const [unconfigured, setUnconfigured] = useState(false);
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
        if (!cancelled) setUnconfigured(needs);
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
    if (!question || busy) return;

    const next: ChatTurn[] = [...turns, { role: 'user', content: question }];
    setTurns(next);
    setDraft('');
    setBusy(true);
    try {
      const res = await askAssistant(next);
      setProvider(res.provider);
      setUnconfigured(res.unconfigured);
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
              <b>Setup incomplete.</b> No ashram timings have been confirmed
              yet, so I can only answer about cycles, lost &amp; found and
              directions. Staff: confirm the entries in{' '}
              <code>lib/ashram-knowledge.ts</code> on site and mark them{' '}
              <code>confirmed</code>.
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

      <form
        className="yc-assist-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about the campus…"
          className="yc-field is-flex"
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
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
