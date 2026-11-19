"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bot, Loader2, MessageSquarePlus, Send } from "lucide-react";
import { api, ApiError, clearToken, getToken, streamPost } from "@/lib/api";

type Source = { n: number; page: number; snippet: string; score: number };
type DocInfo = {
  id: string;
  title: string;
  status: string;
  page_count: number | null;
};
type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; sources: Source[] }
  | { role: "error"; text: string };

type HistoryResponse = {
  conversationId: string | null;
  messages: { role: "user" | "assistant"; text: string; sources: Source[] }[];
};

function AssistantMessage({ text, sources }: { text: string; sources: Source[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const active = sources.find((s) => s.n === open);

  const parts = text.split(/(\[\d+\])/g).map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return <span key={i}>{part}</span>;
    const n = Number(match[1]);
    if (!sources.some((s) => s.n === n)) return <span key={i}>{part}</span>;
    return (
      <button
        key={i}
        type="button"
        onClick={() => setOpen(open === n ? null : n)}
        className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-indigo-100 px-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200"
      >
        {n}
      </button>
    );
  });

  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
        <Bot size={18} />
      </div>
      <div className="max-w-[85%] space-y-2">
        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-4 py-3 text-neutral-900">
          {parts}
        </div>
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => setOpen(open === s.n ? null : s.n)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  open === s.n
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-indigo-300"
                }`}
              >
                Sumber {s.n} · hal. {s.page}
              </button>
            ))}
          </div>
        )}
        {active && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-neutral-700">
            <p className="mb-1 font-medium text-indigo-800">Halaman {active.page}</p>
            <p>{active.snippet}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<DocInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<DocInfo>(`/documents/${id}`)
      .then(setDoc)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
        } else {
          router.replace("/documents");
        }
      });
  }, [id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, asking]);

  useEffect(() => {
    if (!getToken()) return;
    api<HistoryResponse>(`/documents/${id}/history`)
      .then((h) => {
        setConversationId(h.conversationId ?? undefined);
        setMessages(
          h.messages.map(
            (m): Message =>
              m.role === "user"
                ? { role: "user", text: m.text }
                : { role: "assistant", text: m.text, sources: m.sources }
          )
        );
      })
      .catch(() => {});
  }, [id]);

  function newChat() {
    setMessages([]);
    setConversationId(undefined);
  }

  const ready = doc?.status === "ready";

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3 || asking) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setAsking(true);

    let sources: Source[] = [];
    let started = false;

    try {
      await streamPost(
        `/documents/${id}/ask-stream`,
        { question: q, conversationId },
        (event, data) => {
          if (event === "meta") {
            const d = data as { conversationId: string; sources: Source[] };
            sources = d.sources;
            setConversationId(d.conversationId);
          } else if (event === "token") {
            const { text } = data as { text: string };
            if (!started) {
              started = true;
              setMessages((m) => [...m, { role: "assistant", text, sources }]);
            } else {
              setMessages((m) => {
                const last = m[m.length - 1];
                if (!last || last.role !== "assistant") return m;
                return [...m.slice(0, -1), { ...last, text: last.text + text }];
              });
            }
          } else if (event === "error") {
            const { message } = data as { message: string };
            setMessages((m) => [...m, { role: "error", text: message }]);
          }
        }
      );
    } catch (err) {
      setMessages((m) => [...m, { role: "error", text: (err as Error).message }]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-3xl flex-col px-4">
      <header className="flex items-center gap-3 border-b border-neutral-200 py-4">
        <Link
          href="/documents"
          className="rounded-lg border border-neutral-300 p-2 text-neutral-700 hover:bg-neutral-100"
          aria-label="Kembali ke daftar dokumen"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-semibold text-neutral-900">{doc?.title ?? "Memuat..."}</h1>
          {doc?.page_count ? (
            <p className="text-sm text-neutral-500">{doc.page_count} halaman</p>
          ) : null}
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={newChat}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            <MessageSquarePlus size={16} /> Percakapan baru
          </button>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto py-4">
        {doc && !ready && (
          <p className="text-sm text-amber-700">
            Dokumen ini belum siap ditanyai. Kembali ke daftar dokumen dan tunggu sampai statusnya Siap.
          </p>
        )}
        {ready && messages.length === 0 && (
          <p className="text-neutral-500">Ajukan pertanyaan tentang dokumen ini.</p>
        )}

        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-white">
                  {m.text}
                </div>
              </div>
            );
          }
          if (m.role === "error") {
            return (
              <p key={i} className="text-sm text-red-600">
                {m.text}
              </p>
            );
          }
          const refused = m.text.startsWith("Saya tidak menemukan informasi");
          return <AssistantMessage key={i} text={m.text} sources={refused ? [] : m.sources} />;
        })}

        {asking && messages[messages.length - 1]?.role === "user" && (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 size={16} className="animate-spin" /> Mencari jawaban di dokumen...
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 py-4">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Tulis pertanyaan tentang dokumen ini..."
          disabled={!ready || asking}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-indigo-500 disabled:bg-neutral-100"
        />
        <button
          type="submit"
          disabled={!ready || asking || question.trim().length < 3}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <Send size={16} /> Kirim
        </button>
      </form>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<p className="p-8 text-neutral-500">Memuat...</p>}>
      <ChatContent />
    </Suspense>
  );
}