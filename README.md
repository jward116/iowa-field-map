# Iowa Tribe Field Map — Responder Terminal

A single-file web map for first responders working **Doniphan and Brown counties in
Kansas and Richardson County in Nebraska**, and the Iowa Tribe of Kansas & Nebraska
reservation that straddles them.

It answers four questions without taking your hands off the wheel for long: **which
county am I in**, **where is the reservation line**, **what address am I passing**, and
**how do I get to the one I was given**.

- **Jurisdiction at a glance** — each county is shaded its own colour and a banner
  names the one your GPS fix is actually inside, with an `ON RESERVATION` chip when
  you cross the line. Both are point-in-polygon against geometry already on the map,
  so they keep working with no signal.
- **Addresses as you drive** — houses accumulate in a feed as you pass them, address in
  large type, which side of the road, how far off it, and the time.
- **Search and route** — type an address, get turn-by-turn to it, with automatic
  re-routing when you leave the line.
- **Property records** — every field the public services publish, plus a one-tap handoff
  into the county's own owner lookup.

**Live at https://jward116.github.io/iowa-field-map/** — open that on the phone you take
in the truck. It has to be the https link, not a local file: browsers only give a page
your GPS location over https.

**Live at https://jward116.github.io/iowa-field-map/** — open that on the phone you take
in the truck. It has to be the https link, not a local file: browsers only give a page
your GPS location over https.

For local work, serve the folder (`python3 -m http.server`) rather than opening the file
directly, so the address-points file and the offline service worker can load.

## Which build am I looking at?

Open **⚙ SETUP** — the build stamp is the first line, e.g. `build 2026-08-06.4 · offline cache active`.
`?selftest=1` prints it too. If that doesn't match what was last merged, the deploy didn't land.

Check the deploy itself under the repo's **Actions → "Deploy to Pages"**. Every run prints the
build stamp it published in the run summary, so comparing that against what SETUP shows on the
phone is a two-second check. A failed or skipped `deploy` job means the site is still serving the
previous commit, however green the merge looked.

Deploys run through `.github/workflows/deploy.yml`, not GitHub's legacy branch pipeline. That
pipeline failed twice on this repo — hanging 15 minutes before cancelling itself, then queueing
indefinitely — with no logs and no way to retry, while a four-month-old build stayed live. The
workflow gives real logs, a **Re-run jobs** button, and refuses to publish if the inline script
or the service worker fails to parse.

> **`.nojekyll` must stay in the repo root.** Without it, GitHub Pages runs every deploy through
> Jekyll. This site uses no Jekyll features, so that step is pure risk — it is what hung a deploy
> for 15 minutes and left an old build live for hours.

## First run, on the phone you'll actually use

1. Open the link above and allow location when asked.
2. Open `?livecheck=1` once. It hits every endpoint for real and prints a sample record
   from each. Everything should read OK except the three owner/parcel slots marked
   `not set`, which are deliberate — see **Owner records** below.
3. While still on wifi, pan to the area you'll be driving and press **⚙ SETUP → SAVE
   THIS AREA** so the map still draws in dead zones.
4. Tap **DRIVE**.

## What's on the map

Every endpoint below was verified against the live service, with the record counts
they actually returned.

| Layer | Source | Notes |
|---|---|---|
| Reservation boundary | TIGERweb AIANNHA/2, `AIANNH = '1590'` | Iowa (KS-NE) Reservation. Drawn heaviest — it is the line that changes who has authority |
| Off-reservation trust land | TIGERweb AIANNHA/3, same code (dashed) | |
| County shading | TIGERweb `State_County/11`, GEOIDs `20043`, `20013`, `31147` | Doniphan amber, Brown violet, Richardson teal; 12% fill so roads read through |
| KS address points | Kansas NG911 statewide | **4,320 Doniphan + 6,237 Brown**. The only house-level source on the Kansas side |
| NE address points | `giscat.ne.gov … Address_Points/0` | Richardson County, scoped by `COUNTY` |
| NE parcels | `giscat.ne.gov … StatewideParcelsExternal/0` | situs, parcel id, acres, assessed value, legal description. Scoped to `County_ID = '147'` |
| KS parcels | **none published** | no public service covers these counties — see below |
| Routing | OSRM (`router.project-osrm.org`) | repointable in SETUP |
| Live GPS | browser geolocation | patrol-car marker with heading; ◎ re-centers |

## Owner records

**No free API publishes owner names for these three counties.** That was checked, not
assumed:

- **Kansas ORKA** (`KS_Parcels_ORKA_EB`) is described as statewide but returns only four
  county codes — `CN`, `RA`, `SH`, `TH` — across all three of its layers. Doniphan and
  Brown are not among them, so `parcels.ks.url` is deliberately blank rather than
  pointing at a service that would report "0 parcels" forever.
- **Doniphan County's own** assessor service answers `499 Token Required`.
- **Nebraska's statewide parcels** carry `Ownership_Type` (a classification code, and
  empty in practice) but no name field.

So the map carries every field that *is* machine-readable and hands off for the name.
Tapping a parcel or address gives **OWNER RECORD**, which copies the parcel ID to the
clipboard and opens that county's own lookup:

| County | Lookup |
|---|---|
| Doniphan, KS | `doniphangis.integritygis.com` |
| Brown, KS | Kansas ORKA, `kansasgis.org/orka` |
| Richardson, NE | `nebraskaassessorsonline.us` |

None of the three accepts a parcel ID in the query string — ORKA hands out session
URLs — hence the clipboard rather than a deep link that would quietly not work.

If you obtain a licensed county feed, paste it into **SETUP → Kansas / Nebraska owner
service**. Owner names then appear inline in popups and the drive feed with no redeploy;
those sources already outrank the others, since they are the only ones that can supply a
name.

## Jurisdiction

Which county you are standing in decides whose authority applies, so it is answered on
the map rather than by reading a line off it. Each county carries its own tint and the
banner names the one your fix is inside — from your GPS position, not the map centre,
because the two differ the moment you pan.

Richardson County is GEOID **31147**. It was `31153` — Sarpy County, ninety miles up the
river in the Omaha metro — which left the entire Nebraska side of the reservation with
no county line at all.

A point mid-river can read `OUTSIDE COVERAGE AREA`: the Census county polygons meet at
the state line and do not tile the water channel. That is the honest answer, not a bug.

## How addresses are labelled

NG911 records store an address as separate NENA fields rather than one string, and
**the two states do not use the same field names**:

| | house no. | pre-dir | street | type | post-dir | combined |
|---|---|---|---|---|---|---|
| Kansas | `HNO` | `PRD` | `RD` | `STS` | `POD` | `LABEL` |
| Nebraska | `ADD_NUM` | `PRE_DIR` | `ST_NAME` | `ST_TYPE` | `POS_DIR` | `FULL_ADDR` |

Only the Kansas dialect was recognised, so every Nebraska record fell through to
component assembly, failed to find a house number, and rendered as a bare street name —
`1107 Harlan Street` logged as *Harlan Street*. The house number is the entire point of
the record on a response. Both dialects are covered now and `?selftest=1` asserts a real
record shape from each state.

Labels also carry the context that tells two similar addresses apart — there is a
`100 Chestnut St` in both White Cloud and Troy:

- **City**, preferring the incorporated place, falling back to the postal community when
  the record says `UNINCORPORATED` (which is a value in these datasets, not a blank).
- **State and ZIP**, inferred from the county when the record omits the state.
- **`ESN`** — the emergency service number, i.e. which fire/EMS/law district.
- **Unit, building, floor, room** where present. Which apartment matters on a call.

Parcels only render at zoom **15+** (the statewide layers are dense). The header shows
`PARCELS: ZOOM IN` / `PARCELS: LIVE`, and tapping the map reads out coordinates.

## Search and routing

**GO** in the header opens a full-screen search. It geocodes against the same NG911
services the drive engine uses, scoped to the three counties — a hit is therefore
guaranteed to be somewhere you can actually be dispatched, and each row arrives carrying
its ESN and municipality.

Pick a result and it routes, with a next-manoeuvre banner, distance and ETA, the full
turn list, and automatic re-routing after three consecutive fixes more than 50 m off the
line. Tapping any row in the drive feed offers **ROUTE HERE**, because the reason that
feed exists is that a house you drove past is one you may have to go back to.

Three things worth knowing:

- **The Kansas service takes ~18 s to answer any attribute query.** That is the service,
  not the query — a bare `COUNTY = 'DONIPHAN COUNTY'` count takes the same. Its *spatial*
  queries are fast, which is why the drive engine is unaffected. The search timeout is
  set above that floor; at 12 s every Kansas search silently returned "no match".
- **Results render per-service as they arrive.** Nebraska answers in well under a second;
  holding its results back for Kansas means staring at `SEARCHING…` with the answer
  already in hand.
- **The cached corridor is searched first**, instantly and with no request, so the house
  you just passed comes up before anything goes out to the network.

Routing responses are never cached, in memory or by the service worker. A route is
computed from where you were when you asked; replaying a stored one would give
turn-by-turn from a previous position while looking entirely current.

## Drive mode

The `MAP | DRIVE` toggle in the header switches between the map above and a Waze-style
driving view. **MAP mode is unchanged** — every drive-mode change records its own inverse
and is undone on exit, so leaving drive mode restores the layer control, legend, readout,
parcel layers, zoom and centre exactly as you left them.

In DRIVE mode the map follows your GPS at zoom 17 with your position low on screen for
look-ahead, and **house addresses accumulate in a feed as you drive past them** — address
in large type, how far off the road it was, which side, and the time. Tap a row to fly
there, open the full record, or route to it.

Your position is drawn as a **patrol car** pointed along your heading, with an
alternating light bar: on a busy map, motion finds the vehicle faster than colour does.
Until there is a heading worth trusting it stays a plain dot — a car pointed the wrong
way is a lie, a dot is not.

### What's coming up

Above the map, the next three addresses **ahead of you** — distance, which side, and the
number, nearest one largest:

```
200 ft  L   210 MAIN ST
240 ft  R   213 MAIN ST
240 ft  L   208 MAIN ST
```

The feed below is a record of houses already passed. This is the opposite, and it is the
one you want when you are *looking* for a number rather than recording one.

A candidate counts as ahead when it projects forward onto your heading within 400 m
(~16 s at 55 mph) and sits within 45 m of the line you are travelling. Measuring the
forward component separately from the lateral offset is what keeps the next parallel
road out of the list — a house there may be 80 m away, but it is 80 m sideways, not
80 m up the road. It reads entirely from the corridor already cached, so it costs no
network and keeps working with no signal.

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
| `ahead.range` | 400 m | ~16 s at 55 mph — long enough to read and act on, short enough that the list stays the road you are on |
| `ahead.corridor` | 45 m | deliberately under `passRadius`: this list must not fill with the next parallel road |

### Testing it without driving

Open with `?sim=1` (or tap the header title five times — works on a phone with no
keyboard). Tap the map to draw a route along any real road, **SEED HOUSES** to place
synthetic address points along it, then **PLAY**.

Speed, time compression, GPS jitter and a **dropped-fixes** slider are all adjustable.
Dropped fixes at high compression is the single most valuable test here: it is how the
segment-distance behaviour above is verified, and the failure it catches would otherwise
only show up at 55 mph on a real road.

### The two test modes

**`?selftest=1`** — 87 assertions over the pure logic: geometry, point-in-polygon,
dedup, CSV escaping, search query construction, OSRM step parsing, the approach
corridor, and address assembly against **real record shapes captured from both
states**. Invented fixtures are exactly what let the Nebraska bug survive, since the
old field lists parse a Kansas record perfectly.

**`?livecheck=1`** — every configured endpoint hit for real, with a sample record
printed back. This is the one that matters. `selftest` proves the code is right about
data it is handed; `livecheck` proves the data is there at all, and that is the failure
this app actually had — a reservation filtered on a field that does not exist, a county
GEOID pointing at Sarpy, and a parcel service that had 404'd. No amount of unit testing
surfaces any of those.

Each service is probed over ground it actually covers; testing the Nebraska services
from White Cloud reports a false failure, because White Cloud sits on the Kansas bank
and the nearest Richardson County address is further out than any sensible radius. A
live GPS fix overrides the probe point, so from the truck the question becomes whether
the service works *here*.

Run `livecheck` after any endpoint change, and from the phone when something looks wrong
in the field.

## Offline

Rural Richardson, Brown and Doniphan have real dead zones, so:

- The **app itself opens with no signal** — a service worker caches the page and its libraries.
- **Map tiles you have already viewed keep drawing**, capped at ~3000 tiles and evicted oldest-first.
- **SAVE THIS AREA** (in SETUP) pre-loads the current view across zooms 12–16 before you leave
  wifi, with a tile count shown up front and a hard cap so it can't run away with your storage.
- Addresses keep logging from the cached corridor regardless — that was already true.

GIS service responses are deliberately **never** cached: stale ownership is worse than none.

The **page itself is fetched network-first** with the cache as fallback. Cache-first on the page
is how a service worker quietly pins a device to an old build forever — the app keeps opening and
looks perfectly healthy while never picking up another deploy. Offline still works; when there is
signal, the newest build wins. A new version announces itself with a tap-to-reload notice rather
than swapping code under a moving vehicle.

If a phone is ever stuck on an old build, SETUP → **CLEAR TILES** and a reload will clear it.

## Configuration

Almost nothing needs editing by hand — the **⚙ SETUP** screen edits every service URL on the
device and saves it there. Use `?nooverrides=1` to ignore saved overrides and load the
built-in defaults, and RESET DEFAULTS to clear them.

The built-in defaults live in the `CONFIG` block at the top of `index.html`:

- **`ownerServices.ks` / `ownerServices.ne`** — blank. Paste a licensed county appraiser
  feed here (or in SETUP) and owner names appear inline everywhere.
- **`parcels.ks.url`** — blank, because no public service covers Doniphan or Brown. See
  **Owner records** above for what was checked.
- **`routing.url`** — OSRM's public server. Repoint it at your own instance and the
  request shape is identical.
- **`jurisdiction.byGeoid`** — the county colours and names. Adding a fourth county means
  adding its GEOID here, to `counties.where`, and to `COUNTY_LOOKUPS`; `?selftest=1`
  asserts those three stay in agreement.
- **`addressPoints.url`** — an optional local GeoJSON (default
  `data/address_points.geojson`) for tribal points not in either state's NG911. Copy
  `data/address_points.sample.geojson` and populate it. Absent is a normal state.

The popup field-extraction is **schema-tolerant**: it matches owner/situs/parcel-id/acres/
value/land-use by keyword, so it works across differing county schemas, and lists any
remaining attributes under "All attributes." Two keywords are deliberately excluded —
`location`, because Nebraska's parcel layer uses it for a classification code and
matching it labelled parcels `03` where an address belongs, and `ownership_type`, which
is a category rather than a name.

## Where the data comes from

Parcel and address records are **public county and state data, fetched live in the
browser at view time** — none of it is stored in this repository. Only the map code and a
format-only sample are committed.

**The drive-mode log records which houses a vehicle drove past.** It is stored in that
browser's local storage and is never transmitted anywhere. `CLEAR` wipes it; setting
`CONFIG.storage.enabled = false` stops it surviving a reload at all.

*Public-domain government sourcing.*
