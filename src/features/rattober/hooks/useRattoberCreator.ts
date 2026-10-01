import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RATTOBER_CATEGORY_LABELS,
  type RattoberCategoryId,
} from "../config/categories";
import type { RattoberSelection } from "../lib/compositeCanvas";
import { compositeRatToBlob } from "../lib/compositeCanvas";
import {
  isTraitImageLoaded,
  loadTraitImageWithFallback,
  preloadTraitUrls,
} from "../lib/imageLoad";
import { resolveRenderStack } from "../lib/layerStack";
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
  shouldUseNativeWebShare,
  tryNativeShareRat,
} from "../lib/shareRat";

function wrapIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return ((index % length) + length) % length;
}

function layerSourcesForSelection(
  selection: RattoberSelection,
  includeStructural: boolean,
) {
  return resolveRenderStack(selection, { includeStructural })
    .map(({ category, traitId }) => {
      const trait = findTraitById(category, traitId);
      if (!trait) return null;
      return {
        preview: traitAssetUrl(category, trait.file, "preview"),
        full: traitAssetUrl(category, trait.file, "full"),
      };
    })
    .filter(Boolean) as { preview: string; full: string }[];
}

function allLayersCached(sources: { preview: string; full: string }[]): boolean {
  return sources.every(
    (s) => isTraitImageLoaded(s.preview) || isTraitImageLoaded(s.full),
  );
}

export function exportBlockedMessage(selection: RattoberSelection): string | null {
  if (isSelectionComplete(selection)) return null;
  const missing = firstMissingCategory(selection);
  if (!missing) return "SUBJECT CONFIGURATION INCOMPLETE.";
  return `SELECT ${RATTOBER_CATEGORY_LABELS[missing]} TO COMPLETE YOUR RAT.`;
}

export function useRattoberCreator() {
  const [selection, setSelection] = useState<RattoberSelection>(buildEmptySelection);
  const [displaySelection, setDisplaySelection] =
    useState<RattoberSelection>(buildEmptySelection);
  const [previewRefreshing, setPreviewRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<RattoberCategoryId>("skins");
  const [subjectId, setSubjectId] = useState(() => randomSubjectId());
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareBlob, setShareBlob] = useState<Blob | null>(null);
  const [feedback, setFeedback] = useState("");
  const syncGeneration = useRef(0);
  const displaySelectionRef = useRef(displaySelection);
  displaySelectionRef.current = displaySelection;

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

  useEffect(() => {
    if (!ready) return;

    if (!characterStarted) {
      syncGeneration.current += 1;
      setDisplaySelection(buildEmptySelection());
      setPreviewRefreshing(false);
      return;
    }

    const sources = layerSourcesForSelection(selection, true);
    if (sources.length === 0) return;

    const generation = ++syncGeneration.current;
    const hadDisplay = hasAnyTraitSelected(displaySelectionRef.current);

    const commitDisplay = () => {
      if (generation !== syncGeneration.current) return;
      setDisplaySelection(selection);
      setPreviewRefreshing(false);
    };

    if (allLayersCached(sources)) {
      commitDisplay();
      return;
    }

    if (hadDisplay) {
      setPreviewRefreshing(true);
    } else {
      setDisplaySelection(selection);
    }

    void Promise.all(
      sources.map(({ preview, full }) => loadTraitImageWithFallback(preview, full)),
    )
      .then(commitDisplay)
      .catch(() => {
        if (generation === syncGeneration.current) {
          setDisplaySelection(selection);
          setPreviewRefreshing(false);
        }
      });
  }, [selection, ready, characterStarted]);

  useEffect(() => {
    if (activeTraits.length === 0) return;
    const urls = activeTraits.map((t) =>
      traitAssetUrl(activeCategory, t.file, "preview"),
    );
    preloadTraitUrls(urls);
  }, [activeCategory, activeTraits]);

  useEffect(() => {
    if (activeTraits.length === 0) return;
    const currentIdx = selectedIndex ?? 0;
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
    const trait = findTraitById(category, traitId);
    if (trait) {
      void loadTraitImageWithFallback(
        traitAssetUrl(category, trait.file, "preview"),
        traitAssetUrl(category, trait.file, "full"),
      );
    }
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
    const next = buildRandomSelection();
    for (const { category, traitId } of resolveRenderStack(next, {
      includeStructural: true,
    })) {
      const trait = findTraitById(category, traitId);
      if (trait) {
        void loadTraitImageWithFallback(
          traitAssetUrl(category, trait.file, "preview"),
          traitAssetUrl(category, trait.file, "full"),
        );
      }
    }
    setSelection(next);
    setSubjectId(randomSubjectId());
  }, []);

  const reset = useCallback(() => {
    syncGeneration.current += 1;
    setSelection(buildEmptySelection());
    setDisplaySelection(buildEmptySelection());
    setPreviewRefreshing(false);
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
      if (shouldUseNativeWebShare()) {
        const result = await tryNativeShareRat(blob, subjectId);
        if (result === "shared") return;
        if (result === "cancelled") return;
      }
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
    displaySelection,
    previewRefreshing,
    characterStarted,
    selectionComplete,
    activeCategory,
    setActiveCategory,
    activeTraits,
    selectedIndex,
    subjectId,
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
