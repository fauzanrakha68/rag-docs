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
      options: { temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM gagal (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { message: { content: string } };
  return data.message.content;
}