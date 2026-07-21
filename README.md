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

*Public-domain government sourcing. Intended for the tribe's internal planning, dispatch,
and field reference.*
