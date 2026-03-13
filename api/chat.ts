export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const models = ['openai-large', 'openai'];
  const incoming = req.body || {};
  const messages = incoming.messages;
  const temperature = incoming.temperature ?? 0.5;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  let lastError = 'Unknown error';

  const modelQueue = Array.from(new Set([incoming.model, ...models].filter(Boolean)));

  for (const model of modelQueue) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort('Text API timeout'), 45000);

      const response = await fetch('https://text.pollinations.ai/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        lastError = `Pollinations error (${response.status}, model=${model}): ${errText}`;
        continue;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) {
        lastError = `Pollinations returned empty content for model=${model}`;
        continue;
      }

      res.status(200).json(data);
      return;
    } catch (error: any) {
      lastError = error?.message || String(error);
    }
  }

  res.status(502).json({ error: lastError });
}
