# Rattober artwork — developer guide

## Where to put Simsy's final artwork

Place **2048×2048 PNG** trait files here:

```
public/assets/rattober/
  backgrounds/
  skins/
  clothing/
  eyes/
  mouths/
  hats-hair/
```

Then regenerate the manifest (also builds WebP thumbnails for fast UI):

```bash
npm run rattober:manifest
```

This writes `public/assets/rattober/_derived/thumbs/` (512px grid) and
`_derived/preview/` (1024px live preview). **Export/download still uses full 2048 PNGs.**

Commit the updated `src/features/rattober/config/traits.generated.json` (and the PNGs under `public/assets/rattober/`).

## File rules (required for alignment)

- Format: **PNG**
- Size: **2048 × 2048**
- Transparency: preserve alpha where needed
- **Do not crop** traits to visible bounds — keep the full master canvas
- Do not resize or reposition layers in code — alignment is baked into the PNGs

## Layer order (compositing)

Back → front:

1. Background  
2. Skin  
3. Clothing  
4. Eyes  
5. Mouth  
6. Hats / Hair  

Preview and export use the same order (`RATTOBER_RENDER_ORDER` in `src/features/rattober/config/categories.ts`).

## UI category order

Background → Skin → Clothing → Mouth → Eyes → Hats/Hair (`RATTOBER_UI_ORDER`).

## How traits are registered

1. Drop PNGs into the folder for that category  
2. Run `npm run rattober:manifest`  
3. The script writes `traits.generated.json` with `id`, `name`, `category`, `file`  
4. Public URLs resolve to `/assets/rattober/<folder>/<file>`

To **remove** traits: delete PNGs and re-run the manifest script.

To **rename** labels shown in the UI: filenames are humanised automatically; adjust the filename or extend the generator later.

## Default rat

On load, the creator picks the **first trait in each category** (sorted filename). To change defaults, reorder filenames or set explicit defaults in code later.

## Share caption

Edit only:

`src/features/rattober/config/shareCopy.ts`

## Future compatibility fields

Trait entries can later gain `enabled`, `weight`, `incompatibleWith`, `requires` without changing the folder layout.
