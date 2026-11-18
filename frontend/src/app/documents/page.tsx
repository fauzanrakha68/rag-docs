"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, Loader2, LogOut } from "lucide-react";
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

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<Doc[]>("/documents")
      .then(setDocs)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
        } else {
          setError((err as Error).message);
        }
      });
  }, [router]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Dokumen saya</h1>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          <LogOut size={16} /> Keluar
        </button>
      </header>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {docs === null && !error && (
        <p className="flex items-center gap-2 text-neutral-500">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </p>
      )}
      {docs?.length === 0 && (
        <p className="text-neutral-500">Belum ada dokumen. Fitur upload kita buat di bagian berikutnya.</p>
      )}

      <ul className="space-y-3">
        {docs?.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <FileText className="text-neutral-400" size={20} />
              <div>
                <p className="font-medium text-neutral-900">{d.title}</p>
                <p className="text-sm text-neutral-500">
                  {d.page_count ? `${d.page_count} halaman · ` : ""}
                  {new Date(d.created_at).toLocaleDateString("id-ID")}
                </p>
              </div>
            </div>
            <StatusBadge status={d.status} />
          </li>
        ))}
      </ul>
    </main>
  );
}