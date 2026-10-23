# FlowTwin AI browser lab

Buildless Arabic/English browser application. Serve `dist/` with `python -m http.server 4177 --bind 127.0.0.1 --directory dist`. Site identity is retained in `.openai/hosting.json`.

## Intersection architecture

`traffic-engine.js` defines the shared road geometry, 12 dedicated incoming lanes (left/through/right on each of four approaches), curved trajectories, and signal permissions. `intersection-map.js` draws that topology; `simulation-view.js` displays the exact permissions used to admit vehicles. No separate visual signal controller exists.

Four protected stages: north/south through/right → north/south left → east/west through/right → east/west left. Each transition has 3 s amber, then at least 1.5 s all-red, extended until committed vehicles clear. Right on red is not modeled. Fixed control uses 12 s through and 6 s left greens. Adaptive control evaluates hold versus the next demanded stage over a 24 s synthetic-demand forecast. Cost = total waiting + 2 × bus waiting, giving a bus second total weight 3. Review interval is 4 s; through greens have 8–24 s limits and left greens 4–12 s limits. Emergency priority bypasses the normal minimum green but retains amber/clearance and holds a compatible stage until the ambulance clears. All timing values are experiment assumptions, not field-calibrated settings.

Protected movement separation is informed by the [FHWA MUTCD reference](https://mutcd.fhwa.dot.gov/kno_11th_Editionr1.htm); the app is not a certified traffic controller. Ready, paused, rebuilding and ended playback states are explicit; saved lamps are inactive while playback is paused. Event explanations come from the actual engine, not a presentation timer.

## SafeCross lifecycle

`safecross-engine.js` integrates reaction, constant deceleration and restart acceleration. Normal pedestrian cycle: observation → warning → all-red clearance → stopped vehicle and WALK → pedestrian clearance → vehicle release/acceleration → exit. A single multicolor roadside beacon is outside the carriageway, active while a vehicle is observed and off before observation/after exit. Unreliable observation invokes a red fail-safe and blocks WALK. Insufficient stopping margin and actual arrival at the hazard are distinct failed/held outcomes.

Overheight trucks stay stopped if the danger remains and no diversion is declared. Declared diversion travel uses an explicitly modeled 40 m branch and is included in time/fuel accounting. A stopped truck is never silently released under an unsafe bridge. Zero cruise speed and unfinished horizon outcomes are explicit.

`SafeCross.settings` exports all assumptions: 3 s amber, 2 s clearance, 8 s crossing, 2 s recovery, 2 m/s² restart acceleration, 60 m exit buffer, 40 m diversion, 3 s observation of a held stop, and 120 s maximum observation horizon. Inputs use metres, seconds and km/h; speed is converted to m/s internally. JSON records contain initial inputs, assumptions, events, complete result, engine version and provenance. Last 30 completed runs persist locally. Imports are validated without claiming verified sensor provenance.

## Quantities

Intersection coordinates/speeds are illustrative model units. Waiting averages use every arriving vehicle, including upstream queues outside the view; they are cumulative delay, not complete journey time. Both compared strategies receive identical arrivals, movement assignments, bus arrivals, seed and horizon. Greater-than-one EcoTwin ratios indicate worse outcomes and remain visible.

Fuel = (idle vehicle-seconds × idle L/h + moving vehicle-seconds × moving L/h) / 3600. Defaults are 0.8 L/h and 4 L/h. CO₂ uses 8.887 kg per 3.785411784 L, an uncalibrated gasoline-equivalent assumption for every vehicle symbol. CO₂ and fuel are dependent indicators. No independent NOx, PM2.5 or planetary-boundary measurement is claimed.

## Validation

```text
node tests/traffic-engine.test.cjs
node tests/turns-priority.test.cjs
node tests/safecross.test.cjs
node tests/release-regression.test.cjs
node audit/run-audit.cjs
```

Traffic tests cover collision-free travel, actual movement permissions, red-light entry, conservation, deterministic replay and strategy changes. Extended auditing checks 180 runs / 648,000 model states over ten seeds. A green permission is independently exercised for each lane/stage, and the integration audit requires zero hidden spatial-conflict stops. SafeCross tests include independent analytical braking integrals, WALK/vehicle permissions, restart/exit, bridge/diversion holds, uncertainty, numeric input bounds, fuel/CO₂ units and accounting conservation.

Review evidence is included in `audit/realistic-review-2026-10-23/`, with the latest interface checks in `audit/results-explained-2026-10-23/`. These files stay outside the hosted `dist/` directory. The audit writes fresh output to `audit/generated/` by default. Older numerical reports describe older model versions and must not be quoted as current results.

## Scope

This is an executable browser experiment with synthetic inputs. Camera/edge detection, trained congestion prediction, SUMO, physical signals/ESP32, calibrated emissions, actual network/cloud synchronization and multi-vehicle SafeCross integration are not connected. Cloud-outage scene and imported observation fields are model inputs, not field validation. Architecture/roadmap pages describe the intended deployment pipeline.
