export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const PUTER_MODELS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'google/gemini-2.0-flash-lite',
  'google/gemini-2.0-flash',
];

const buildPrompt = (messages: ChatMessage[]): string => {
  return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
};

const extractText = (response: any, shouldTrim = true): string => {
  const normalize = (value: string): string => (shouldTrim ? value.trim() : value);

  if (!response) return '';
  if (typeof response === 'string') return normalize(response);
  if (typeof response?.message?.content === 'string') return normalize(response.message.content);
  if (typeof response?.content === 'string') return normalize(response.content);
  if (typeof response?.text === 'string') return normalize(response.text);

  if (Array.isArray(response?.choices) && typeof response.choices[0]?.message?.content === 'string') {
    return normalize(response.choices[0].message.content);
  }

  if (Array.isArray(response?.output)) {
    const combined = response.output
      .map((item: any) => item?.content || item?.text || '')
      .filter(Boolean)
      .join('\n');
    return normalize(combined);
  }

  return '';
};

export const isPuterAvailable = (): boolean => {
  return typeof window !== 'undefined' && Boolean((window as any).puter?.ai?.chat);
};

export const callPuterGemini = async (messages: ChatMessage[]): Promise<string> => {
  const puter = (window as any).puter;
  if (!puter?.ai?.chat) {
    throw new Error('Puter SDK is not available');
  }

  const prompt = buildPrompt(messages);
  let lastError: unknown;

  for (const model of PUTER_MODELS) {
    try {
      const response = await puter.ai.chat(prompt, { model });
      const text = extractText(response);
      if (!text) {
        throw new Error(`Puter returned empty content (model=${model})`);
      }
      return text;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Puter chat failed');
};

export const streamPuterGemini = async function* (
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  const puter = (window as any).puter;
  if (!puter?.ai?.chat) {
    throw new Error('Puter SDK is not available');
  }

  const prompt = buildPrompt(messages);
  let lastError: unknown;

  for (const model of PUTER_MODELS) {
    try {
      const response = await puter.ai.chat(prompt, { model, stream: true });
      let emitted = false;

      for await (const part of response) {
        const text = extractText(part, false);
        if (text) {
          emitted = true;
          yield text;
        }
      }

      if (!emitted) {
        throw new Error(`Puter stream returned empty content (model=${model})`);
      }

      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Puter stream chat failed');
};
