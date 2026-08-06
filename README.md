# Iowa Tribe Field Map — Parcel & Address Terminal

A single-file web map for the Iowa Tribe of Kansas & Nebraska's own use (planning,
NG911 / dispatch reference, and field work). It plots the reservation on a dark,
touch-friendly base and pulls **per-parcel owner records live from public county /
state assessor services** when you zoom in.

Open `index.html` in any modern browser, or serve the folder (`python3 -m http.server`)
so the optional address-points file can load.

## What's on the map

| Layer | Source | Notes |
|---|---|---|
| Reservation boundary | Census TIGERweb AIANNH, `AIANNHCE = 2430` | Iowa (KS-NE) Reservation |
| Off-reservation trust land | Census TIGERweb AIANNH (dashed) | verify parcel-level trust/fee against BIA LTRO |
| NE parcels + owner | `giscat.ne.gov … TaxParcels2023/0` | tap a parcel for owner, situs, parcel id, acres, assessed value, land use |
| KS parcels + owner | **you configure** | Kansas statewide ownership is often license-restricted — see below |
| Address points (NG911) | optional local GeoJSON | tap for the address record |
| Live GPS | browser geolocation | field position + accuracy ring; ◎ button re-centers |

Parcels only render at zoom **15+** (the statewide layers are dense). The header shows
`PARCELS: ZOOM IN` / `PARCELS: LIVE`, and tapping the map reads out coordinates.

## Drive mode

The `MAP | DRIVE` toggle in the header switches between the map above and a Waze-style
driving view. **MAP mode is unchanged** — every drive-mode change records its own inverse
and is undone on exit, so leaving drive mode restores the layer control, legend, readout,
parcel layers, zoom and centre exactly as you left them.

In DRIVE mode the map follows your GPS at zoom 17 with your position low on screen for
look-ahead, and **house addresses accumulate in a feed as you drive past them** — address
in large type, owner name inline, how far off the road it was, which side, and the time.
Tap a row to fly there and open the full parcel record.

- **Follow-lock** releases when you grab the map and resumes 12 s after you let go, or
  immediately via the ◎ button. Address logging is independent of the camera and keeps
  running while you pan.
- **HDG UP** rotates the map so your direction of travel is up. Off by default. It needs
  the optional `leaflet-rotate` script; if that fails to load the app stays north-up and
  the button hides itself.
- Exports the log as **CSV** or **GeoJSON**. The GeoJSON round-trips into the simulator
  below, so a real drive can be replayed at a desk.
- The screen wake lock is held while driving; parcel polygons are removed from the map
  (they would page continuously at zoom 17 and are the biggest battery and data cost).

### How addresses are found

Reverse-geocoding every GPS tick is not viable — the free geocoders cap at about one
request per second and rural cell coverage drops out. Instead the engine **prefetches a
corridor** of candidate addresses in one request per ~400 m driven, then matches against
that cache locally on every tick. Network cost is O(1) per 400 m, and **the feed keeps
working after you lose signal**, from whatever corridor is already cached.

Two details that matter more than they look:

- Distance is measured to the **segment you just travelled**, not to your current
  position. At 55 mph a 3-second GPS gap covers 74 m — wider than the 60 m detection
  radius — so a plain "anything near me right now?" test silently skips houses.
- Responses that arrive **after** you have already driven past their houses are matched
  against your recent track and logged at the fix where the pass actually happened, so a
  slow response over rural LTE loses nothing and still reports the right time and side.

Sources are tried in priority order and each fails independently — a county service that
is slow, down, or unconfigured never stops the others, and each reports its own state in
the HUD badges (`NG911: 42` / `NE PARCEL: ERROR` / `KS PARCEL: NOT SET`).

| Setting | Default | Why |
|---|---|---|
| `engine.prefetchRadius` | 1200 m | 3× the move threshold, so corridors triple-overlap and one failed request leaves no hole |
| `engine.prefetchMove` | 400 m | ~4 requests/min per source at 55 mph; still 800 m of cached road ahead at the circle edge |
| `engine.prefetchLead` | 300 m | biases the query circle forward along your heading — same cost, more road ahead |
| `engine.passRadius` | 60 m | rural setbacks are 20–50 m, phone accuracy in a moving vehicle 5–15 m, next road on a ¼-mile grid 402 m |
| `engine.maxSegment` | 2000 m | above this we assume a backgrounded phone resumed elsewhere and don't log the straight line between |
| `engine.sourceTimeoutMs` | 15 s | a hung request must never stop a source prefetching for the rest of the shift |
| `engine.cacheCap` | 4000 | ~1 MB; evicted farthest-from-you first, so the road ahead survives |

### Testing it without driving

Open with `?sim=1` (or tap the header title five times — works on a phone with no
keyboard). Tap the map to draw a route along any real road, **SEED HOUSES** to place
synthetic address points along it, then **PLAY**.

Speed, time compression, GPS jitter and a **dropped-fixes** slider are all adjustable.
Dropped fixes at high compression is the single most valuable test here: it is how the
segment-distance behaviour above is verified, and the failure it catches would otherwise
only show up at 55 mph on a real road.

`?selftest=1` runs the geometry, dedup and CSV-escaping assertions and prints the results.

## Configuration

Everything adjustable is in the `CONFIG` block at the top of `index.html`:

- **`parcels.ks.url`** — set this to the Brown/Doniphan County appraiser service or the
  Kansas DASC parcel service you are licensed to use. Left blank by default because
  statewide KS ownership is commonly access-restricted.
- **`addressPoints.url`** — point at a GeoJSON file (default `data/address_points.geojson`)
  or an ArcGIS feature service of your NG911 points. Copy `data/address_points.sample.geojson`
  to `data/address_points.geojson` and populate it. The loader fails silently if absent.
- **`reservation` / `trust`** — if the boundary doesn't draw, confirm the TIGERweb
  AIANNHA sublayer index and field name at `.../AIANNHA/MapServer?f=json`.

The popup field-extraction is **schema-tolerant**: it matches owner/situs/parcel-id/acres/
value/land-use by keyword, so it works across differing county schemas, and lists any
remaining attributes under "All attributes."

## Data provenance & privacy

- Parcel ownership is **public county assessor data**, fetched live in the browser at view
  time — **none of it is stored in this repository.** Only the map code and a format-only
  sample (no owner names) are committed.
- **Trust vs. fee status is not asserted** by this map; confirm against BIA LTRO or county
  records (owner shown as "United States in trust for the Iowa Tribe…" indicates trust).
- Re-verify time-sensitive designations on the day of use; assessor values update annually.
- **The drive-mode log is a record of which houses a vehicle drove past, with owner names,
  and it may sit on a shared field device.** It is stored in that browser's local storage
  and **is never transmitted anywhere**. `CLEAR` wipes it, and setting
  `CONFIG.storage.enabled = false` stops it surviving a reload at all. Worth a decision
  before this goes on real devices — it is a governance question, not a technical one.
- Drive mode is **passenger use**. The feed needs no interaction to work and can announce
  each address with a chime so the driver never has to look at the screen; a one-time
  acknowledgement says so before drive mode opens.

*Public-domain government sourcing. Intended for the tribe's internal planning, dispatch,
and field reference.*
