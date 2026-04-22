import Anthropic from '@anthropic-ai/sdk';
import type { ThemeJSON } from '../types';

const CLAUDE_MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 8000;
const SYSTEM_PROMPT =
  'You are a wedding website visual designer. Return only valid JSON. ' +
  'No markdown fences. No explanation. Just the JSON object.';

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  return new Anthropic({ apiKey });
}

export async function callClaude(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const parts = response.content
    .filter((c): c is Anthropic.Messages.TextBlock => c.type === 'text')
    .map((c) => c.text);

  const text = parts.join('\n').trim();
  if (!text) {
    throw new Error('Claude returned an empty response');
  }
  return text;
}

/**
 * Strip markdown fences (if any) and extract the outermost JSON object.
 * Throws a descriptive error on failure.
 */
export function parseThemeJSON(raw: string): ThemeJSON {
  if (!raw || typeof raw !== 'string') {
    throw new Error('parseThemeJSON: raw input is empty');
  }

  let text = raw.trim();

  // Strip ``` / ```json fences
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z0-9_-]*\s*/, '');
    text = text.replace(/\s*```\s*$/, '');
  }

  // Find the outermost object
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    console.error('[parseThemeJSON] raw response:', raw);
    throw new Error('parseThemeJSON: no JSON object found in response');
  }

  const slice = text.slice(first, last + 1);

  try {
    return JSON.parse(slice) as ThemeJSON;
  } catch (err) {
    console.error('[parseThemeJSON] raw response:', raw);
    throw new Error(
      `parseThemeJSON: failed to JSON.parse — ${(err as Error).message}`,
    );
  }
}
