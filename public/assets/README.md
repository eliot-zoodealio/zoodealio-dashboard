# Asset Slots

Drop branded asset files into this folder using the exact filenames below. The dashboard auto-loads them and falls back to inline placeholders when a file isn't found — no code changes needed.

PNG and SVG both work for the logo and the two hero icons. The current `index.html` points at `.png` for those three slots; if you swap to SVG later, change the `.png` extensions in the `<img src=...>` tags. Zee mascot poses are inline SVG today.

## Logo

| Slot | File | Notes |
|---|---|---|
| Header logo | `logo-zoodealio.png` | Wordmark + Zee lockup. Renders at ~14vw wide (~270px on a 1920 display); aim for at least 600px wide for crispness at TV scale. Transparent background. |

## Hero tile icons (highest visual priority)

These show on the two hero cards (Closed Acquisitions, Closed Resale). They sit on a deep blue gradient background, so design with white / light fills and transparent backgrounds.

| Slot | File | Used by |
|---|---|---|
| Acquisitions Closed | `icon-closed-acquisition.png` | "Closed Acquisitions" hero tile (left side). Suggested motif: house with a key going in, "CO+" / "Flip" badge, etc. |
| Resale Closed | `icon-closed-resale.png` | "Closed Resale" hero tile (right side). Suggested motif: SOLD sign, sale tag, house with a "for sale" sign, etc. |

Recommended size: 256–512px square. They render at ~3.6vw on the dashboard.

## Zee mascot poses (animation system)

The dashboard ships with one inline Zee SVG and uses CSS to animate it for peek / drop / swing. Once you provide pose-specific files, future versions of the front-end can swap to the matching pose per animation type.

| Slot | File | When it shows |
|---|---|---|
| Idle | `zee-idle.svg` | Sitting on the goal bar, default state |
| Peek | `zee-peek.svg` | Acceptances tile increases — Zee peeks up from the bottom corner |
| Drop | `zee-drop.svg` | Closings tile increases — Zee drops from the top with a bounce |
| Swing | `zee-swing.svg` | Goal of 30 closings is hit — Zee swings excitedly above the goal bar |

For now, drop in `zee-idle.svg` whenever ready and that one will be used as a base for all positions. A code update can wire the others to specific animations once they exist.

## Optional pipeline tile icons

These have inline placeholders that already work fine. Replace if you want fully on-brand icons.

| Slot | File | Tile |
|---|---|---|
| Handshake | `icon-acceptance.svg` | Acceptances |
| Clipboard | `icon-inspection.svg` | Inspection / Inspection Accepted |
| Calendar | `icon-calendar.svg` | Projected Closings |
| Hammer | `icon-hammer.svg` | Renovations in Process |
| For-sale tag | `icon-tag.svg` | Listings / Under Contract |

(Wiring for these auto-overrides will land in a follow-up; for now the inline placeholders are used.)

## Confetti palette

The celebration confetti pieces (map-pin shaped) use these colors. Edit the `palette` array near the bottom of `public/app.js` to change.

- `#8FC043` — Zoodealio green
- `#B5DC6E` — Light green
- `#0E50B0` — Royal blue
- `#3D6FB5` — Medium blue
- `#1A5EBF` — Deep blue
