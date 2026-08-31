# Aarhus Public Transport — interactive map

Interactive, poster-grade map of the public transport network of **Aarhus**:
Midttrafik's 55 city and regional bus lines and both Aarhus Letbane lines —
1 206 stops, 2 798 km, weighted mean matching error 0.17 m, the tightest fit in
the whole family.

## Live

Local build on port 8168 (`npm run serve`).

Everything comes from the **national Rejseplanen GTFS** — the same file
copenhagen-bus-map uses, all of Denmark in one bundle — so the map's scope is a
precomputed allowlist (`pipeline/scope.mjs` → `data/scope.json`).

| mode | route_type | scope | graph |
|---|---|---|---|
| buses | 3 | Midttrafik, ≥50% of stops within 25 km of Aarhus H, no stop past 45 km | OSM roadways |
| letbane | 0 | both lines whole | `tram` + `light_rail` + `rail` |

Letbane L1 ends in **Grenaa, 60 km out**, and that stretches the frame
north-east. Cutting it would have been a lie: it is not a tail but the whole
line, the old Grenaa railway rebuilt as light rail — the same call Copenhagen's
S-tog to Hillerød and Stockholm's pendeltåg to Uppsala got. The rail extract is
deliberately wider than the road one for that reason.

The letbane keeps the family's tram red rather than Midttrafik's own line
colours: colour means the MODE in this family.

Cut deliberately: `route_type` 715 — Flextur and the telebusser, 44 of them in
this frame; they carry numbers but no fixed run — the DSB and GoCollective
regional trains (2, as in Copenhagen) and the Samsø ferries (4).

## Pipeline

`npm run download` fetches the feed, computes the scope, and cuts the OSM extract. **The OSM
data comes from Geofabrik, not Overpass** — the public mirrors were answering
504 to every request on the day this map was built, even for a single small
city box — so `pipeline/pbf-tiles.py` (needs `pip3 install --user osmium`)
clips the tiles out of `denmark-latest.osm.pbf`, writing exactly the JSON shape Overpass would
have returned, node ids included.

`npm run build` map-matches every line (HMM/Viterbi on the OSM graph) and
writes GeoJSON to `data/out/`; `npm run lines` adds the line-by-line view.
`npm run serve` hosts the map at <http://localhost:8168>.

Data: Rejseplanen / Midttrafik ·
base map © OpenFreeMap / OpenMapTiles / OpenStreetMap contributors.
