const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.LLM_MODEL || "qwen2.5:3b";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      keep_alive: "30m",
      options: { temperature: 0.2, num_predict: 400 },
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM gagal (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { message: { content: string } };
  return data.message.content;
}

export async function* chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      keep_alive: "30m",
      options: { temperature: 0.2, num_predict: 400 },
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`LLM gagal (${res.status}): ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parse = (line: string) => {
    if (!line.trim()) return "";
    const chunk = JSON.parse(line) as { message?: { content?: string } };
    return chunk.message?.content ?? "";
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const piece = parse(line);
      if (piece) yield piece;
    }
  }
  const last = parse(buffer);
  if (last) yield last;
}