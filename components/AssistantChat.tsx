'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import { askAssistant } from '@/app/assistant-actions';
import type { ChatTurn } from '@/lib/ai';

/**
 * Sahayata AI — a floating assistant for visitor questions.
 *
 * Sits above every tab because the questions it answers ("where is the temple",
 * "which stand has cycles") do not belong to any one of them.
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Keep the newest message in view as the conversation grows.
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [turns, busy]);

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

  // Closed state renders nothing: the trigger lives in the header (see
  // MainDashboard), so the assistant does not float over the map or compete
  // with the primary action at the bottom of the screen.
  if (!open) return null;

  return (
    <div className="yc-assist-panel" role="dialog" aria-label="Sahayata AI">
      <header className="yc-assist-head">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--primary-dark)' }} />
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
