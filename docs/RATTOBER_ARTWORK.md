# Rattober artwork — developer guide

## Active artwork (creator + website)

Place **2048×2048 PNG** trait files only under:

```
public/assets/rattober/
  backgrounds/              ← base colour / full-canvas backgrounds
  background-overlays/      ← scenic frames (DarkPath, Grave, etc.)
  skins/
  clothing/
  lower-rings/              ← structural ring layers (often auto-applied)
  outer-rings/
  eyes/
  mouths/
  hats-hair/
```

Then:

```bash
npm run rattober:manifest
```

The manifest scans **only** `public/assets/rattober/` (not `archive/`). WebP derivatives are written under `_derived/` for fast UI; **export uses full PNGs**.

## Render order (back → front)

1. **Base background** (`backgrounds/`)
2. **Background overlay / scene** (`background-overlays/`) — transparent circular centre reveals base below
3. **Skin**
4. **Clothing**
5. **Lower ring** (`lower-rings/`) — over skin/clothing
6. **Outer ring** (`outer-rings/`) — over lower ring
7. **Eyes**
8. **Mouth**
9. **Hats / hair**

Preview and 2048×2048 export use the same stack (`RATTOBER_RENDER_ORDER` / `resolveRenderStack()`).

## Creator tabs (user-facing)

Skin → Clothing → Eyes → Mouth → Hats/Hair → **Background** → **Scene**

- **Background** = base background  
- **Scene** = background overlay (not a replacement for base background)

**Lower ring** and **outer ring** are structural. If only one PNG exists per folder, they auto-composite when building a rat (not on the idle logo). They are not randomised and are not creator tabs unless we add variants later.

## Archived old collection

```
archive/rattober-original-collection/
```

Not served and not scanned by the manifest.

## File rules

- PNG, **2048 × 2048**, full shared canvas, preserve transparency  
- Do not crop traits to visible bounds in code  

## Trait names

Filenames are humanised in the manifest (e.g. `Professor-Hair.png` → **Professor Hair**).

## Share caption

`src/features/rattober/config/shareCopy.ts`
