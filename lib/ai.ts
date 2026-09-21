/**
 * One entry point for every AI call in the app.
 *
 * Two providers are supported and picked from the environment:
 *
 *   ANTHROPIC_API_KEY  -> Claude, via the Anthropic SDK
 *   GROQ_API_KEY       -> Groq's OpenAI-compatible endpoint, via fetch
 *
 * Anthropic wins when both are set. With neither, callers fall back to their
 * own deterministic rules, which is why every AI feature in this app still
 * works offline.
 *
 * The two APIs differ in three ways that matter here, all handled below:
 * schema placement (`output_config.format` vs `response_format`), how images
 * are attached (a base64 source object vs a data URL), and where the system
 * prompt lives (a top-level field vs the first message).
 */

import type Anthropic from '@anthropic-ai/sdk';

export type AiProvider = 'anthropic' | 'groq' | 'none';

export interface AiImage {
  mediaType: string;
  /** Base64 data with no data-URL prefix. */
  data: string;
}

export interface AiRequest {
  system: string;
  user: string;
  /** JSON Schema the reply must satisfy. */
  schema: Record<string, unknown>;
  /** Name for the schema; Groq requires one. */
  schemaName: string;
  image?: AiImage | null;
  maxTokens?: number;
}

export interface AiResult<T> {
  data: T | null;
  provider: AiProvider;
}

/**
 * Groq model choices, both verified against a live account: they support
 * json_schema structured outputs, and qwen accepts image input, which is what
 * keeps photo-aware fault triage working. The vision model is used only when
 * an image is attached; the text model is the better default otherwise.
 *
 * Groq rejects images smaller than 32px on a side, so a very small photo falls
 * through to the text model rather than failing the call.
 */
const GROQ_TEXT_MODEL = 'openai/gpt-oss-120b';
const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b';

const ANTHROPIC_MODEL = 'claude-opus-5';

export function activeProvider(): AiProvider {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GROQ_API_KEY) return 'groq';
  return 'none';
}

/** Human-readable label for the badge shown beside AI output. */
export function providerLabel(provider: AiProvider): string {
  if (provider === 'anthropic') return 'Claude';
  if (provider === 'groq') return 'Groq';
  return 'Offline rules';
}

async function callAnthropic<T>(req: AiRequest): Promise<T | null> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();

  const content: Anthropic.ContentBlockParam[] = [];
  if (req.image) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: req.image.mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
        data: req.image.data,
      },
    });
  }
  content.push({ type: 'text', text: req.user });

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: req.maxTokens ?? 1500,
    system: req.system,
    output_config: {
      format: { type: 'json_schema', schema: req.schema },
      effort: 'low',
    },
    messages: [{ role: 'user', content }],
  });

  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') return null;
  return JSON.parse(block.text) as T;
}

async function callGroq<T>(req: AiRequest): Promise<T | null> {
  // Groq takes images as data URLs inside the message content, unlike
  // Anthropic's separate base64 source object.
  const userContent = req.image
    ? [
        {
          type: 'image_url',
          image_url: { url: `data:${req.image.mediaType};base64,${req.image.data}` },
        },
        { type: 'text', text: req.user },
      ]
    : req.user;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    // Without this a hanging upstream call is indistinguishable from a slow
    // one: the request never settles, the caller's catch never runs, and the
    // chat sits on a spinner for ever. A rejection it can report beats
    // silence.
    signal: AbortSignal.timeout(45_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: req.image ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
      max_completion_tokens: req.maxTokens ?? 1500,
      temperature: 0.2,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: userContent },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: req.schemaName,
          schema: req.schema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Groq ${response.status}: ${detail.slice(0, 200)}`);
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content;
  if (!text) return null;
  return JSON.parse(text) as T;
}

/**
 * Run a structured request against whichever provider is configured.
 *
 * Never throws: a failure returns `data: null` so the caller can fall back to
 * its own rules. A reported fault must never be lost because a model was
 * unreachable.
 */
export async function askForJson<T>(req: AiRequest): Promise<AiResult<T>> {
  const provider = activeProvider();
  if (provider === 'none') return { data: null, provider };

  try {
    const data =
      provider === 'anthropic'
        ? await callAnthropic<T>(req)
        : await callGroq<T>(req);
    return { data, provider };
  } catch (error) {
    console.error(`[ai] ${provider} call failed, falling back:`, error);
    return { data: null, provider: 'none' };
  }
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Free-text conversation, for the visitor assistant.
 *
 * Separate from askForJson because that one requires a JSON schema on every
 * call: the other three AI features want a parsed object, whereas this one
 * wants prose. Sharing the provider selection and the never-throw contract,
 * but not the structured-output plumbing.
 *
 * Returns null rather than throwing, so an unreachable model degrades to a
 * "cannot reach the assistant" message instead of an error screen.
 */
export async function askForText(
  system: string,
  history: ChatTurn[],
  maxTokens = 600,
  /**
   * A photo attached to the newest turn. Switches the Groq call to the vision
   * model, which is a different model — so it is passed per call rather than
   * set once for the conversation.
   */
  image?: AiImage | null
): Promise<AiResult<string>> {
  const provider = activeProvider();
  if (provider === 'none') return { data: null, provider };

  try {
    if (provider === 'anthropic') {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic();
      const response = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system,
        messages: history.map((t, i) =>
          image && i === history.length - 1 && t.role === 'user'
            ? {
                role: t.role,
                content: [
                  {
                    type: 'image' as const,
                    source: {
                      type: 'base64' as const,
                      media_type: image.mediaType as
                        | 'image/jpeg'
                        | 'image/png'
                        | 'image/webp'
                        | 'image/gif',
                      data: image.data,
                    },
                  },
                  { type: 'text' as const, text: t.content },
                ],
              }
            : { role: t.role, content: t.content }
        ),
      });
      const block = response.content.find((b) => b.type === 'text');
      return {
        data: block && block.type === 'text' ? block.text : null,
        provider,
      };
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      // Same reason as the other call site: a hang has to become a rejection,
      // or the chat waits on a promise that never settles.
      signal: AbortSignal.timeout(45_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: image ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
        max_completion_tokens: maxTokens,
        // Low but not zero: answers should be phrased naturally while staying
        // close to the facts they are given.
        temperature: 0.3,
        messages: [
          { role: 'system', content: system },
          ...history.map((t, i) =>
            image && i === history.length - 1 && t.role === 'user'
              ? {
                  role: t.role,
                  content: [
                    { type: 'text', text: t.content },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:${image.mediaType};base64,${image.data}`,
                      },
                    },
                  ],
                }
              : t
          ),
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Groq ${response.status}: ${detail.slice(0, 200)}`);
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { data: body.choices?.[0]?.message?.content ?? null, provider };
  } catch (error) {
    console.error('[ai] chat call failed:', error);
    return { data: null, provider: 'none' };
  }
}
