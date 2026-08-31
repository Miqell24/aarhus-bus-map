// Wyznacza zakres mapy Aarhus z KRAJOWEGO feedu Rejseplanen (cała Dania,
// 1589 linii) i zapisuje listy route_id do data/scope.json:
//
//  autobusy (route_type 3, tylko Midttrafik):
//   - linia należy do mapy, gdy >=50% jej przystanków leży w promieniu 25 km
//     od Aarhus H — to zasięg zwartej aglomeracji: Odder, Skanderborg,
//     Hørning, Hinnerup, Hjortshøj i Beder wchodzą, Silkeborg (40 km),
//     Randers (36) i Horsens (45) już nie;
//   - odpada linia z przystankiem dalej niż 45 km.
//  letbane (0): OBIE linie w całości, bez reguły promienia. L1 kończy w
//   Grenaa 60 km na północny wschód i to rozciąga kadr — ale ucięcie jej
//   byłoby kłamstwem: to nie ogon, tylko cała linia, dawna kolej do Grenaa
//   przebudowana na lekką kolej miejską. Ta sama decyzja co przy S-tog do
//   Hillerød w Kopenhadze i pendeltåg do Uppsali w Sztokholmie.
//  poza mapą:
//   - Flextur i telebusy (route_type 715, 44 linie w kadrze) — mają numer,
//     nie mają trasy, to kursy na telefon (reguła Närtrafiken z Göteborga);
//   - kolej regionalna i lokalna DSB/GoCollective (2) — jak w Kopenhadze;
//   - promy do Samsø (4) — silnik nie ma grafu wodnego.
//
// Uruchamiane przez download.sh po pobraniu GTFS; build.mjs wymaga wyniku.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { iterCsv, readCsv } from './lib/csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GD = join(ROOT, 'data/gtfs');

const CX = 10.2039, CY = 56.1500;          // Aarhus H
const CORE_KM = 25, CORE_SHARE = 0.5, CAP_KM = 45;

const t0 = Date.now();
const log = (m) => console.log(`[scope ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

const agency = new Map();
for (const a of await readCsv(join(GD, 'agency.txt'))) agency.set(a.agency_id, (a.agency_name || '').trim());

const busCand = new Set(), letbane = [];
for (const r of await readCsv(join(GD, 'routes.txt'))) {
  const an = agency.get(r.agency_id) || '';
  if (an !== 'Midttrafik') continue;        // the whole map is one operator's
  if (r.route_type === '3') busCand.add(r.route_id);
  else if (r.route_type === '0') letbane.push(r.route_id);
}
log(`kandydatów Midttrafik: ${busCand.size} bus, ${letbane.length} letbane`);

const mx = 111320 * Math.cos(CY * Math.PI / 180), my = 111132;
const stopKm = new Map();
for await (const s of iterCsv(join(GD, 'stops.txt'))) {
  const lat = Number(s.stop_lat), lon = Number(s.stop_lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    stopKm.set(s.stop_id, Math.hypot((lon - CX) * mx, (lat - CY) * my) / 1000);
  }
}
const t2r = new Map();
for await (const t of iterCsv(join(GD, 'trips.txt'))) {
  if (busCand.has(t.route_id)) t2r.set(t.trip_id, t.route_id);
}
log(`kursów autobusowych do zmierzenia: ${t2r.size}`);

const rStops = new Map();
for await (const st of iterCsv(join(GD, 'stop_times.txt'))) {
  const rid = t2r.get(st.trip_id);
  if (!rid) continue;
  let s = rStops.get(rid);
  if (!s) rStops.set(rid, (s = new Set()));
  s.add(st.stop_id);
}

const bus = [];
let cut = 0;
for (const [rid, stops] of rStops) {
  let n = 0, inside = 0, max = 0;
  for (const sid of stops) {
    const d = stopKm.get(sid);
    if (d === undefined) continue;
    n++; if (d <= CORE_KM) inside++; if (d > max) max = d;
  }
  if (!n) continue;
  if (inside / n < CORE_SHARE) continue;
  if (max > CAP_KM) { cut++; continue; }
  bus.push(rid);
}
log(`wybrano bus: ${bus.length} (odrzucone limitem ${CAP_KM} km: ${cut}), letbane ${letbane.length}`);
writeFileSync(join(ROOT, 'data/scope.json'),
  JSON.stringify({ bus: bus.sort(), letbane: letbane.sort() }, null, 0));
log('zapisano data/scope.json');
