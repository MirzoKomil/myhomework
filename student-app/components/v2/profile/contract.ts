/**
 * Shartnoma PDF haqida haqiqiy ma'lumot (hajmi va betlar soni) —
 * serverdagi demo-contract-pdf javobining o'zidan olinadi.
 */
import { authedFetch, getContractPdfUrl } from '@/services/contentApi';

export type PdfInfo = { bytes: number; pages: number };

let cache: Promise<PdfInfo | null> | null = null;

export function fetchContractPdfInfo(): Promise<PdfInfo | null> {
  if (!cache) {
    cache = authedFetch(getContractPdfUrl())
      .then(async (r) => {
        if (!r.ok) return null;
        const buf = await r.arrayBuffer();
        // PDF ichidagi "/Type /Page" (Pages emas) obyektlari soni = betlar soni.
        const text = new TextDecoder('latin1').decode(new Uint8Array(buf));
        const pages = (text.match(/\/Type\s*\/Page(?!s)/g) || []).length;
        return { bytes: buf.byteLength, pages: Math.max(1, pages) };
      })
      .catch(() => null);
    cache.then((v) => { if (!v) cache = null; });
  }
  return cache;
}

export const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
