"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Loader2,
  LogOut,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, ApiError, clearToken, getToken } from "@/lib/api";

type Doc = {
  id: string;
  title: string;
  status: string;
  page_count: number | null;
  created_at: string;
};

function Logo() {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden="true">
      <path d="M2 1h12l6 6v17a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 0-1Z" fill="#fff" stroke="#14213d" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="5" y="12" width="12" height="4" fill="#ffe45c" />
      <rect x="5" y="19" width="8" height="1.8" fill="#14213d" />
    </svg>
  );
}

function PageGlyph({ doc }: { doc: Doc }) {
  const failed = doc.status === "failed";
  const pending = doc.status !== "ready" && !failed;
  return (
    <div className="relative h-11 w-9 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 36 44" className="absolute inset-0 h-full w-full" fill="none">
        <path
          d="M1 3a2 2 0 0 1 2-2h18l14 14v26a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3Z"
          fill="#fff"
          stroke={failed ? "#b3261e" : "#14213d"}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M21 1v11a3 3 0 0 0 3 3h11" stroke={failed ? "#b3261e" : "#14213d"} strokeWidth="1.6" />
      </svg>
      <span className="absolute inset-x-0 bottom-1.5 flex justify-center text-[13px] font-semibold tabular-nums text-ink">
        {pending ? (
          <Loader2 size={14} className="animate-spin text-muted" />
        ) : failed ? (
          <AlertCircle size={14} className="text-danger" />
        ) : (
          doc.page_count ?? "-"
        )}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-highlight px-2 py-0.5 text-sm font-medium text-ink">
        <Check size={14} /> Siap
      </span>
    );
  }
  if (status === "failed") {
    return <span className="text-sm font-medium text-danger">Gagal diproses</span>;
  }
  return <span className="text-sm text-muted">Memproses</span>;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    try {
      setDocs(await api<Doc[]>("/documents"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
      } else {
        setError((err as Error).message);
      }
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch awal, setState terjadi setelah await
    loadDocs();
    api<{ email: string }>("/me")
      .then((me) => setEmail(me.email))
      .catch(() => {});
  }, [router, loadDocs]);

  const hasPending = docs?.some((d) => d.status !== "ready" && d.status !== "failed");

  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(loadDocs, 3000);
    return () => clearInterval(timer);
  }, [hasPending, loadDocs]);

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Hanya file PDF yang diperbolehkan");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Ukuran file maksimal 10 MB");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api("/documents", { method: "POST", body: form });
      await loadDocs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function saveTitle(id: string) {
    const title = draftTitle.trim();
    if (!title) return;
    setBusyId(id);
    setError("");
    try {
      await api(`/documents/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      setDocs((list) => list?.map((d) => (d.id === id ? { ...d, title } : d)) ?? null);
      setEditingId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeDoc(id: string) {
    setBusyId(id);
    setError("");
    try {
      await api(`/documents/${id}`, { method: "DELETE" });
      setDocs((list) => list?.filter((d) => d.id !== id) ?? null);
      setConfirmId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function logout() {
    clearToken();
    router.replace("/login");
  }

  const empty = docs?.length === 0;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-lg font-semibold tracking-tight text-ink">RAG Docs</span>
          </div>
          <div className="flex items-center gap-4">
            {email && <span className="hidden text-sm text-muted sm:inline">{email}</span>}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:underline"
            >
              <LogOut size={16} /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Dokumen saya</h1>
          {docs && docs.length > 0 && (
            <p className="mt-1 text-sm text-muted">{docs.length} dokumen, klik salah satu untuk mulai bertanya.</p>
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            uploadFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            uploadFile(e.dataTransfer.files?.[0]);
          }}
          className={`mb-6 flex w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-center transition-colors disabled:opacity-70 ${
            empty ? "py-14" : "py-5"
          } ${dragging ? "border-ink bg-highlight" : "border-line bg-white hover:border-ink"}`}
        >
          {uploading ? (
            <Loader2 size={22} className="animate-spin text-ink" />
          ) : (
            <Upload size={22} className="text-ink" />
          )}
          <span className="font-medium text-ink">
            {uploading
              ? "Mengunggah..."
              : empty
                ? "Unggah PDF pertamamu untuk mulai bertanya"
                : "Tarik PDF ke sini atau pilih file"}
          </span>
          <span className="text-sm text-muted">Format PDF, maksimal 10 MB</span>
        </button>

        {error && (
          <p role="alert" className="mb-4 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {docs === null && !error && (
          <p className="flex items-center gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" /> Memuat dokumen...
          </p>
        )}

        {docs && docs.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-white">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                <PageGlyph doc={d} />
                {editingId === d.id ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveTitle(d.id);
                    }}
                  >
                    <input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      maxLength={200}
                      aria-label="Judul dokumen"
                      className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-ink outline-none focus:border-ink"
                    />
                    <button
                      type="submit"
                      disabled={busyId === d.id || !draftTitle.trim()}
                      aria-label="Simpan judul"
                      className="rounded-md bg-ink p-2 text-white hover:bg-ink-hover disabled:opacity-60"
                    >
                      {busyId === d.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Batal"
                      className="rounded-md border border-line p-2 text-ink hover:bg-paper"
                    >
                      <X size={16} />
                    </button>
                  </form>
                ) : (
                  <>
                    <Link href={`/documents/${d.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{d.title}</p>
                      <p className="text-sm text-muted">
                        Diunggah{" "}
                        {new Date(d.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </Link>
                    {confirmId === d.id ? (
                      <div className="flex items-center gap-2">
                        <span className="hidden text-sm text-ink sm:inline">Hapus dokumen ini?</span>
                        <button
                          type="button"
                          onClick={() => removeDoc(d.id)}
                          disabled={busyId === d.id}
                          className="inline-flex items-center gap-1 rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                        >
                          {busyId === d.id && <Loader2 size={14} className="animate-spin" />} Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <>
                        <StatusBadge status={d.status} />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(d.id);
                            setDraftTitle(d.title);
                            setConfirmId(null);
                          }}
                          aria-label="Ganti nama dokumen"
                          className="rounded-md p-2 text-muted hover:bg-line/50 hover:text-ink"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmId(d.id);
                            setEditingId(null);
                          }}
                          aria-label="Hapus dokumen"
                          className="rounded-md p-2 text-muted hover:bg-line/50 hover:text-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}