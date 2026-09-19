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
 * Groq model choices. Both support json_schema structured outputs; the vision
 * model is used only when an image is attached, since it is slower and the
 * text model is a better default for the other calls.
 */
const GROQ_TEXT_MODEL = 'openai/gpt-oss-120b';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

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
