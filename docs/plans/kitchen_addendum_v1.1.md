# Yumo — Kitchen Addendum (v1.1)

**Delta brief.** Applies ON TOP of the already-implemented "Kitchen Zoomable Room Master
Brief (v1)". Only changes/additions are listed — everything not mentioned stays as v1.
Values are literal. Reference prototype: `Kitchen.dc.html` (current state).

---

## 1. Scene / room changes

### 1.1 Wall & floor (replaces v1's plain backdrop)
- Wall: one contrasting warm panel behind everything so the scene reads as a room:
  `linear-gradient(180deg, #262019 0%, #211A13 100%)`, radius 14 top corners, height to
  the floor line; over it a soft top light `radial-gradient(90% 70% at 50% 6%,
  rgba(255,190,120,0.06), transparent 60%)`.
- Floor: strip below the line filled `#191410`; floor line 2px `rgba(247,242,234,0.1)`
  at y=408 (design px). Floor shadows under both unit groups: blurred (6px) ellipses
  `rgba(0,0,0,0.45)`, at y≈402.
- NO pendant lamp, NO skirting board, NO floorboard texture (tried and rejected).

### 1.2 Unit materials
- **Fridge + freezer faces are appliance WHITE**:
  `linear-gradient(160deg, #F2ECE2 0%, #E4DCCD 55%, #D3CBBB 100%)`;
  door border `rgba(0,0,0,0.2)`; top edge highlight `rgba(255,255,255,0.45)`;
  handles `rgba(58,48,38,0.4)`. "❄ FREEZER" label on drawer face: `#5B7A8C`.
- **Cupboard doors are WOOD-GRAINED**: layer, top to bottom:
  `repeating-linear-gradient(97deg, rgba(0,0,0,0.16) 0 2px, transparent 2px 8px)` +
  `repeating-linear-gradient(94deg, rgba(255,200,140,0.05) 0 1px, transparent 1px 13px)` +
  `linear-gradient(160deg, #4C3A26, #2F2114)`. Handles `rgba(247,242,234,0.28)`.
- **Film grain** over the whole scene (not scaled by the camera): an SVG
  `feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2"` rect at
  opacity 0.05, pointer-events none. (RN: a static noise PNG overlay at 5% works.)

### 1.3 NEW fourth zone — the Counter (fills the space under the cupboard)
Layout (design px, wrapper at x0 y190, 170×246):
- Open shelf at (24,6) 118 wide: 5 decorative mini jars (amber/tomato/green/cream/
  terracotta bodies with darker lid strips) on a wood board (gradient `#4C3A26→#2F2114`).
- Worktop: slab at (2,102) 162×10, `linear-gradient(180deg,#45403A,#332F29)` + 2px top
  highlight `rgba(247,242,234,0.14)`, shadow.
- Lower cabinet: (8,112) 150×106, same wood-grain recipe as cupboard doors, radius
  0 0 10 10, two drawer lines + centered handle bars.
- Decorative props: fruit bowl (terracotta gradient half-round at (18,90) 44×14),
  chopping board (36×32 wood, rotate 4°, at (78,70)), potted plant (green circles +
  terracotta pot, right end).
- **Functional**: the counter is a real `Zone` ('counter'). Seed items: Oranges (some),
  Apples (plenty), Bananas (low, use-soon), Sourdough loaf (some, use-soon). Live items
  render ON the worktop (first 3 as round fruits in the bowl at slots (24,84,15)/(36,81,14)/
  (30,74,13); 4th as an 18px r6 loaf at (54,82)); each tappable (room → focus counter;
  focused → item sheet). Count badge like other zones. Tossed/out items disappear from
  the worktop.
- Camera target for counter focus: rect x2 y190 w164 h218 (same zoom formula).
- Focused list title: "**On the counter**" (others stay "In the {zone}").
- Hint copy: "Tap a unit or the counter to look inside · the fridge notes are tappable".

## 2. Interior (zoomed) — replaces v1 tile layout

### 2.1 Dynamic shelves
- No fixed shelf Ys. Rows of **3** (slot width 45 design px), rows spread over the FULL
  interior height: `rowStep = (innerH − 16) / nRows`, shelf r at
  `y = 14 + (r+1)·rowStep`, `nRows = ceil(items/3)`, rows centered horizontally
  (`xStart = (innerW − rowCount·45)/2`).
- Shelf boards: 3.5px, `linear-gradient(180deg, shelfColor, rgba(0,0,0,0.15))` +
  drop shadow `0 3px 5px rgba(0,0,0,0.45)`. shelfColor: warm zones
  `rgba(247,242,234,0.22)`, freezer `rgba(159,199,224,0.3)`.
- Interior depth: background is a vertical gradient `interiorBg → interiorBg2`
  (fridge/cupboard `#100D0A → #1A130C`, freezer `#12161A → #1A2129`) with inset shadows
  `inset 0 8px 18px rgba(0,0,0,0.55)` + `inset ±6px 0 12px rgba(0,0,0,0.3)`.
- Zone name inside: 5px, opacity 0.75 (was louder).

### 2.2 Item tiles → glyph tiles
- Size: width `24 + (hash%3)·4`, height `26 + (hash%4)·4` (hash = first two char codes
  of id); round kinds (fruit/produce) are square = min(w,h) with radius 999; loaf radius
  9; all others radius 6. Tile sits bottom-aligned 11px above its shelf; label (6px,
  `#D8CDBB`, ellipsized, 45px wide, centered) between tile and shelf.
- Fill: `linear-gradient(165deg, color 20%, color-mix(color 70%, #1A0F06))`,
  shadow `0 3px 6px rgba(0,0,0,0.4)`. `level==='low'` → opacity 0.6.
- **Kind glyphs** — layered % -positioned sub-shapes inside the tile
  (dark = `color-mix(color 62%, #170D04)`, light = `rgba(255,255,255,0.3)`):
  - `carton` (milk, oats, pasta): dark cap strip 12%,0,76%,18% + light label 20%,40%,60%,26%
  - `jar` (peanut butter): dark lid 8%,0,84%,16% + light label 16%,36%,68%,32%
  - `tin` (tomatoes, chickpeas): light rim 0,6%,100%,8% + dark base 0,84%,100%,8%
  - `eggs`: three light dots 18%×24% r999 at 11%/41%/71%, top 32%
  - `produce` (spinach, broccoli): two overlapping circles (light −8%,−10%,56%,52%;
    dark 48%,−6%,50%,46%)
  - `fruit` (berries): green leaf dot `#4AA875` 58%,−6%,26%,26%
  - `tub` (yogurt, butter, leftovers, ice cream): dark lid overhang −4%,0,108%,20%
  - `loaf` (bread): three dark score lines 12%×48% r999 at 16%/42%/68%
  - `pack` (default: chicken, salmon, peas, veg, rice, cheddar, tofu): light label
    18%,32%,64%,32%
- **Freshness dot** per tile: 7px circle, 1.5px `#100D0A` ring, anchored to the tile's
  top-right corner (`right = (45 − tileW)/2 − 3`, top −3); colours fresh `#5FC48C` /
  soon `#EDA33B` / today `#FF7A5C`. Visible only when the zone is focused (fades with
  labels, 500ms).

## 3. Motion (new/changed)

1. **Springy camera**: zoom transition is now 850ms `cubic-bezier(0.3, 1.16, 0.35, 1)`
   (slight overshoot), was 750ms flat.
2. **Staggered settle**: tiles idle at `translateY(4px) scale(0.88)` behind closed
   doors; when the zone opens each springs to identity —
   520ms `cubic-bezier(0.34, 1.45, 0.5, 1)`, delay `380 + index·55` ms
   (transform-origin bottom-center). Labels + dots fade in over 500ms.
3. **Press dip**: whole unit scales 0.985 on press (150ms), before the zoom.
4. **Door shadow sweep**: inside each interior, `linear-gradient(100deg,
   rgba(0,0,0,0.5), transparent 55%)` at opacity 1 when closed → 0 when open (900ms) —
   reads as the door's shadow sweeping off the shelves.
5. **Use-soon glow**: if a zone contains any item with freshness ≠ fresh, a blurred
   amber bar (`rgba(237,163,59,0.5)`, blur 5, bottom of unit, 72% width) pulses
   (`opacity 0.35↔0.8`, 2.6s ease-in-out infinite) — room view only, hidden when
   anything is focused.
6. **Receipt choreography** (replaces plain fly-in): tap →
   t=0 fridge AND cupboard doors swing open (no camera move) →
   t=750ms items fly in staggered (flyIn from `translate(30px,−320px) scale(0.5)
   rotate(12°)`, 750ms `cubic-bezier(0.34,1.2,0.5,1)`, delay `200+i·130`) →
   t=2900ms doors close. Banner then reads "Scanned — the shopping flew in ✓" and no-ops.
   New items: Broccoli (produce), Cheddar (pack) and Firm tofu (pack) → fridge;
   Wholemeal bread (loaf) → cupboard.
7. **Toss animation**: tossing marks the item, sheet closes immediately, tile plays
   `tossOut` (480ms `cubic-bezier(0.5,0,0.8,0.4)`: to opacity 0,
   `translateY(28px) scale(0.25) rotate(−14°)`), THEN the item is removed (~500ms).
8. **Streak magnet count-up**: on screen mount the magnet counts 0→22 (~1.2s). Derive
   the shown value from elapsed-time-since-mount (n = min(final, round(elapsed/55)·2))
   so a remount restarts cleanly and ALWAYS lands on the final value — do not use a
   naive incrementing interval (it got killed mid-count in testing and stuck at 14).

## 4. Seed-data kinds (for the glyph mapping)

fridge: Milk carton · Greek yogurt tub · Spinach produce · Chicken breast pack ·
Eggs eggs · Butter tub · Berries fruit · Leftover chili tub
freezer: Frozen peas pack · Salmon fillets pack · Mixed veg pack · Ice cream tub
cupboard: Rolled oats carton · Basmati rice pack · Pasta carton · Tinned tomatoes tin ·
Peanut butter jar · Chickpeas tin
counter: Oranges fruit · Apples fruit · Bananas fruit · Sourdough loaf

In production, map food-graph tokens → kind by category; default to `pack`.

## 5. Analytics additions
`kitchen_counter_focused`, plus v1's events unchanged.
