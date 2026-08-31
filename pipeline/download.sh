#!/usr/bin/env bash
# Downloads input data: Rejseplanen GTFS (national), the OSM extracts,
# MapLibre GL. Everything is cached — re-running only fetches what is missing.
#
# The Rejseplanen aggregate covers ALL of Denmark — the same file
# copenhagen-bus-map uses — so the map's scope is computed by
# pipeline/scope.mjs into data/scope.json.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/gtfs data/osm/tiles web/vendor

# pyosmium does the cutting; it is the one dependency outside Node here.
need_osmium () {
  python3 -c "import osmium" 2>/dev/null && return 0
  echo "brak pakietu osmium — zainstaluj: pip3 install --user osmium" >&2
  return 1
}

# 1) GTFS
if [ ! -f data/gtfs/routes.txt ]; then
  echo "== Rejseplanen GTFS (Denmark) =="
  curl -fL --retry 3 --max-time 900 -o data/dk_gtfs.zip \
    "https://www.rejseplanen.info/labs/GTFS.zip"
  unzip -o data/dk_gtfs.zip -d data/gtfs \
    agency.txt routes.txt trips.txt stop_times.txt stops.txt shapes.txt calendar.txt calendar_dates.txt
fi

# 1b) scope: which of the 1589 national lines belong on an AARHUS map
if [ ! -f data/scope.json ]; then
  node --max-old-space-size=8192 pipeline/scope.mjs
fi

# 2) OSM — from the Geofabrik extract, not Overpass.
#    3 x 3 road tiles, and a rail box that reaches further east than the roads
#    because letbane L1 ends in Grenaa, 60 km out.
#    pipeline/pbf-tiles.py cuts the tiles out of the .pbf and writes exactly the
#    JSON shape Overpass would have returned (ways with tags, NODE IDS and
#    geometry — buildGraph silently drops ways without el.nodes).
if [ ! -f data/osm/tiles/t9.json ] || [ ! -f data/osm/aarhus-rail.json ]; then
  need_osmium
  if [ ! -f data/denmark-latest.osm.pbf ]; then
    echo "== Geofabrik denmark-latest.osm.pbf =="
    curl -fL --retry 5 --retry-delay 5 -C - --max-time 3600 -o data/denmark-latest.osm.pbf \
      "https://download.geofabrik.de/europe/denmark-latest.osm.pbf"
  fi
  echo "== cutting OSM tiles out of the extract =="
  python3 pipeline/pbf-tiles.py
fi

# 3) MapLibre GL (vendored, no CDN at runtime)
if [ ! -f web/vendor/maplibre-gl.js ]; then
  echo "== MapLibre GL =="
  curl -fL --retry 3 -o web/vendor/maplibre-gl.js  https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js
  curl -fL --retry 3 -o web/vendor/maplibre-gl.css https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css
fi

echo "OK — data ready:"
du -sh data/gtfs data/osm 2>/dev/null || true
