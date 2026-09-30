import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RATTOBER_CATEGORY_LABELS,
  RATTOBER_RENDER_ORDER,
  type RattoberCategoryId,
} from "../config/categories";
import type { RattoberSelection } from "../lib/compositeCanvas";
import { compositeRatToBlob } from "../lib/compositeCanvas";
import { loadTraitImageWithFallback, preloadTraitUrls } from "../lib/imageLoad";
import {
  buildEmptySelection,
  firstMissingCategory,
  hasAnyTraitSelected,
  isSelectionComplete,
  stepTraitId,
} from "../lib/selectionState";
import { randomSubjectId } from "../lib/subjectId";
import {
  buildRandomSelection,
  findTraitById,
  getTraitsForCategory,
  isManifestReady,
  traitAssetUrl,
} from "../lib/traits";
import {
  downloadRatBlob,
  tryNativeShareRat,
} from "../lib/shareRat";

function wrapIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return ((index % length) + length) % length;
}

export function exportBlockedMessage(selection: RattoberSelection): string | null {
  if (isSelectionComplete(selection)) return null;
  const missing = firstMissingCategory(selection);
  if (!missing) return "SUBJECT CONFIGURATION INCOMPLETE.";
  return `SELECT ${RATTOBER_CATEGORY_LABELS[missing]} TO COMPLETE YOUR RAT.`;
}

export function useRattoberCreator() {
  const [selection, setSelection] = useState<RattoberSelection>(buildEmptySelection);
  const [activeCategory, setActiveCategory] = useState<RattoberCategoryId>("backgrounds");
  const [subjectId, setSubjectId] = useState(() => randomSubjectId());
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareBlob, setShareBlob] = useState<Blob | null>(null);
  const [feedback, setFeedback] = useState("");
  const [previewReady, setPreviewReady] = useState(true);

  const ready = isManifestReady();
  const characterStarted = hasAnyTraitSelected(selection);
  const selectionComplete = isSelectionComplete(selection);

  const activeTraits = useMemo(
    () => getTraitsForCategory(activeCategory),
    [activeCategory],
  );

  const selectedIndex = useMemo(() => {
    const id = selection[activeCategory];
    if (!id) return null;
    const idx = activeTraits.findIndex((t) => t.id === id);
    return idx >= 0 ? idx : null;
  }, [activeCategory, activeTraits, selection]);

  const layerSources = useMemo(() => {
    return RATTOBER_RENDER_ORDER.map((cat) => {
      const trait = findTraitById(cat, selection[cat]);
      if (!trait) return null;
      return {
        preview: traitAssetUrl(cat, trait.file, "preview"),
        full: traitAssetUrl(cat, trait.file, "full"),
      };
    }).filter(Boolean) as { preview: string; full: string }[];
  }, [selection]);

  useEffect(() => {
    if (!ready || !characterStarted) {
      setPreviewReady(true);
      return;
    }
    if (layerSources.length === 0) {
      setPreviewReady(true);
      return;
    }
    let cancelled = false;
    setPreviewReady(false);
    Promise.all(
      layerSources.map(({ preview, full }) =>
        loadTraitImageWithFallback(preview, full),
      ),
    )
      .then(() => {
        if (!cancelled) setPreviewReady(true);
      })
      .catch(() => {
        if (!cancelled) setPreviewReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [layerSources, ready, characterStarted]);

  useEffect(() => {
    if (activeTraits.length === 0) return;
    const currentIdx =
      selectedIndex ?? (activeTraits.length > 0 ? 0 : 0);
    const prev = activeTraits[wrapIndex(currentIdx - 1, activeTraits.length)];
    const next = activeTraits[wrapIndex(currentIdx + 1, activeTraits.length)];
    const current = activeTraits[currentIdx];
    preloadTraitUrls(
      [prev, next, current]
        .filter(Boolean)
        .map((t) => traitAssetUrl(activeCategory, t!.file, "preview")),
    );
  }, [activeCategory, selectedIndex, activeTraits]);

  const incompleteMessage = useCallback(
    () => exportBlockedMessage(selection) ?? "SUBJECT CONFIGURATION INCOMPLETE.",
    [selection],
  );

  const selectTrait = useCallback((category: RattoberCategoryId, traitId: string) => {
    setSelection((prev) => ({ ...prev, [category]: traitId }));
  }, []);

  const stepTrait = useCallback(
    (direction: -1 | 1) => {
      const ids = activeTraits.map((t) => t.id);
      const nextId = stepTraitId(ids, selection[activeCategory], direction);
      if (nextId) selectTrait(activeCategory, nextId);
    },
    [activeCategory, activeTraits, selectTrait, selection],
  );

  const randomise = useCallback(() => {
    setSelection(buildRandomSelection());
    setSubjectId(randomSubjectId());
  }, []);

  const reset = useCallback(() => {
    setSelection(buildEmptySelection());
    setSubjectId(randomSubjectId());
    setFeedback("");
  }, []);

  const exportRat = useCallback(async () => {
    if (!selectionComplete) {
      setFeedback(incompleteMessage());
      return null;
    }
    if (exporting) return null;
    setExporting(true);
    setFeedback("");
    try {
      const blob = await compositeRatToBlob(selection);
      downloadRatBlob(blob, subjectId);
      return blob;
    } catch {
      setFeedback("Export failed. Try again.");
      return null;
    } finally {
      setExporting(false);
    }
  }, [exporting, incompleteMessage, selection, selectionComplete, subjectId]);

  const shareRat = useCallback(async () => {
    if (!selectionComplete) {
      setFeedback(incompleteMessage());
      return;
    }
    if (sharing) return;
    setSharing(true);
    setFeedback("");
    try {
      const blob = await compositeRatToBlob(selection);
      setShareBlob(blob);
      const result = await tryNativeShareRat(blob, subjectId);
      if (result === "shared") return;
      if (result === "cancelled") return;
      setShareModalOpen(true);
    } catch {
      setFeedback("Share failed. Try download instead.");
    } finally {
      setSharing(false);
    }
  }, [incompleteMessage, selection, selectionComplete, sharing, subjectId]);

  return {
    ready,
    selection,
    characterStarted,
    selectionComplete,
    activeCategory,
    setActiveCategory,
    activeTraits,
    selectedIndex,
    subjectId,
    previewReady,
    exporting,
    sharing,
    shareModalOpen,
    setShareModalOpen,
    shareBlob,
    feedback,
    setFeedback,
    selectTrait,
    stepTrait,
    randomise,
    reset,
    exportRat,
    shareRat,
  };
}
