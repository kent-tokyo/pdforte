import { useState, useCallback, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfStore } from "../../store/pdfStore";

export interface SearchResult {
  pageIndex: number;
  pageNumber: number;
  excerpt: string;
  matchStart: number;
}

export function useSearch(pdfDoc: PDFDocumentProxy | null) {
  const setCurrentPage = usePdfStore(s => s.setCurrentPage);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentResultIdx, setCurrentResultIdx] = useState(-1);
  const abortRef = useRef(false);

  const search = useCallback(async (q?: string) => {
    const searchQuery = q !== undefined ? q : query;
    if (!pdfDoc || !searchQuery.trim()) {
      setResults([]);
      setCurrentResultIdx(-1);
      return;
    }
    abortRef.current = true;
    await new Promise<void>((r) => setTimeout(r, 0));
    abortRef.current = false;
    setIsSearching(true);
    setResults([]);
    const lower = searchQuery.toLowerCase();
    const found: SearchResult[] = [];
    try {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (abortRef.current) break;
        const page = await pdfDoc.getPage(i);
        const tc = await page.getTextContent();
        const text = tc.items.map((item) => ("str" in item ? (item as { str: string }).str : "")).join("");
        const lc = text.toLowerCase();
        let idx = lc.indexOf(lower);
        while (idx !== -1 && found.length < 200) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(text.length, idx + lower.length + 50);
          found.push({
            pageIndex: i - 1,
            pageNumber: i,
            excerpt: (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : ""),
            matchStart: idx - start + (start > 0 ? 1 : 0),
          });
          idx = lc.indexOf(lower, idx + 1);
        }
        if (found.length >= 200) break;
      }
    } finally {
      setIsSearching(false);
    }
    setResults(found);
    setCurrentResultIdx(found.length > 0 ? 0 : -1);
    if (found.length > 0) setCurrentPage(found[0].pageNumber);
  }, [pdfDoc, query, setCurrentPage]);

  const navigate = useCallback((dir: 1 | -1) => {
    if (results.length === 0) return;
    const next = (currentResultIdx + dir + results.length) % results.length;
    setCurrentResultIdx(next);
    setCurrentPage(results[next].pageNumber);
  }, [results, currentResultIdx, setCurrentPage]);

  return { query, setQuery, results, isSearching, currentResultIdx, setCurrentResultIdx, search, navigate };
}
