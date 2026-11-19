"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Check,
  FileText,
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

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-green-700">
        <CheckCircle2 size={16} /> Siap
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-red-700">
        <AlertCircle size={16} /> Gagal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-amber-700">
      <Loader2 size={16} className="animate-spin" /> Diproses
    </span>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
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
  }, [router, loadDocs]);

  const hasPending = docs?.some((d) => d.status !== "ready" && d.status !== "failed");

  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(loadDocs, 3000);
    return () => clearInterval(timer);
  }, [hasPending, loadDocs]);

  async function handleUpload(e: { target: HTMLInputElement }) {
    const file = e.target.files?.[0];
    e.target.value = "";
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

  return (
<main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Dokumen saya</h1>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Unggah PDF
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {docs === null && !error && (
        <p className="flex items-center gap-2 text-neutral-500">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </p>
      )}
      {docs?.length === 0 && (
        <p className="text-neutral-500">Belum ada dokumen. Unggah PDF untuk memulai.</p>
      )}

      <ul className="space-y-3">
        {docs?.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 hover:border-indigo-300"
          >
            {editingId === d.id ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveTitle(d.id);
                }}
              >
                <FileText className="shrink-0 text-neutral-400" size={20} />
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  maxLength={200}
                  aria-label="Judul dokumen"
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-900 outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={busyId === d.id || !draftTitle.trim()}
                  aria-label="Simpan judul"
                  className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {busyId === d.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  aria-label="Batal"
                  className="rounded-lg border border-neutral-300 p-2 text-neutral-700 hover:bg-neutral-100"
                >
                  <X size={16} />
                </button>
              </form>
            ) : (
              <>
                <Link href={`/documents/${d.id}`} className="flex flex-1 items-center gap-3">
                  <FileText className="shrink-0 text-neutral-400" size={20} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">{d.title}</p>
                    <p className="text-sm text-neutral-500">
                      {d.page_count ? `${d.page_count} halaman · ` : ""}
                      {new Date(d.created_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </Link>
                {confirmId === d.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-700">Hapus dokumen ini?</span>
                    <button
                      type="button"
                      onClick={() => removeDoc(d.id)}
                      disabled={busyId === d.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {busyId === d.id && <Loader2 size={14} className="animate-spin" />} Hapus
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
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
                      className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
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
                      className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600"
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
    </main>
  );
}