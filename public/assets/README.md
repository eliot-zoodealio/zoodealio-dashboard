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
| Acquisitions Closed | `Closed Acquisitions Icon.png` | "Closed Acquisitions" hero tile (left side). Suggested motif: house with a key going in, "CO+" / "Flip" badge, etc. Note the spaces and capitalization — filename is matched literally (URL-encoded as `%20` in HTML). |
| Resale Closed | `Closed Resale Icon.png` | "Closed Resale" hero tile (right side). Suggested motif: SOLD sign, sale tag, house with a "for sale" sign, etc. Note the spaces and capitalization — filename is matched literally (URL-encoded as `%20` in HTML). |

Recommended size: 256–512px square. They render at ~3.6vw on the dashboard.

## Zee mascot poses (animation system)

The dashboard uses Zee in two places: as a marker that rides along the goal bar, and as a celebration character that peeks / drops / swings onto the screen when numbers tick up.

### Goal-bar marker (highest visual priority)

| Slot | File | Notes |
|---|---|---|
| Goal-bar marker | `zee-head.png` | Zee head only, facing forward. Sits on the green goal-progress fill and slides left → right as closings come in. Transparent background. Recommended source size 256–512px square; renders at ~3vw on screen. PNG or SVG both work — if you swap to SVG, change the `<img src>` extension in `index.html`. |

When the file is missing, the dashboard falls back to the inline SVG full-body Zee. Just drop your file at `public/assets/zee-head.png` and it'll start using it on next deploy.

### Celebration character (currently wired)

The celebration asset is used for the **peek** and **swing** animations only. The **drop** animation always uses the inline SVG full-body Zee, since a top-down drop motion doesn't fit the upright celebration pose. CSS handles the motion; the asset just provides the character.

| Slot | File | When it shows |
|---|---|---|
| Celebration Zee | `Celebration-Zee.001.png` | Peek (any tile increase on the acquisitions side) and swing (30-closing goal hit). Note the exact capitalization and the `.001` segment — the filename is matched literally. Recommended source size 512–1024px tall, transparent background, character roughly upright/forward. PNG or SVG both work — if you swap to SVG, change the extension in `public/app.js` (search for `Celebration-Zee.001.png`). |

When the file is missing (or the filename doesn't match exactly), the dashboard falls back to the inline SVG full-body Zee.

## Pipeline tile icons

The Acceptances tile is already wired to a custom slot. The other tiles still use inline SVG placeholders — drop their files in and tell me when you want them wired the same way.

### Currently wired

| Slot | File | Tile | Status |
|---|---|---|---|
| Acceptances | `acceptance-icon.png` | Acceptances (pipeline strip) | Wired — `<img>` with onerror fallback to inline handshake. PNG or SVG both work; if you ever swap to SVG, change the extension in `public/index.html`. Recommended source size 256–512px square, transparent background. |

### Future-ready (placeholders still active)

| Slot | File | Tile |
|---|---|---|
| Clipboard | `icon-inspection.png` | Inspections / Insp. Accepted |
| Calendar | `icon-calendar.png` | Projected Close |
| Hammer | `icon-hammer.png` | In Shop (Renovations) |
| For-sale tag | `icon-tag.png` | Listings / Under Contract |

For these, drop the file in this folder and ping the dev — they'll be wired the same way as Acceptances (one-line edit per tile).

## Confetti palette

The celebration confetti pieces (map-pin shaped) use these colors. Edit the `palette` array near the bottom of `public/app.js` to change.

- `#8FC043` — Zoodealio green
- `#B5DC6E` — Light green
- `#0E50B0` — Royal blue
- `#3D6FB5` — Medium blue
- `#1A5EBF` — Deep blue
