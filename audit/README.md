# Recorded validation

`realistic-review-2026-10-23/` contains the 180 paired traffic runs (648,000 checked states), outputs at 60/120/180 seconds, source hashes from that review, and the traffic/SafeCross test logs. The traffic and SafeCross engines are unchanged in the latest UI update.

`results-explained-2026-10-23/` contains the latest source hashes, captured browser text for three scenarios, and screenshots of the revised decision costs and outcome comparison. Interface source hashes supersede the earlier interface hashes; engine hashes still match.

At demand 70%, seed 19, and 180 seconds, congestion average waiting changes from 24.4258928572 to 23.2707589286 seconds (1.1551339286 seconds / 4.7291% lower). Bus delay changes from 26.735 to 21.325 seconds. These are model results, not field measurements or daily projections. Total waiting and average waiting are the same underlying quantity before/after division by arrivals.

The offline scenario increases bus delay from 14.0026315789 to 15.9684210526 seconds; the interface shows that deterioration. In the ambulance scenario, crossing time changes from 31.8 to 14.0 seconds, measured from request arrival until crossing completes.

Run the four test commands in the project README for the focused checks. Run `node audit/run-audit.cjs` for the extended traffic audit; fresh outputs go to the ignored `audit/generated/` folder. It may take several minutes. The supplied evidence records the experiments already run; publishing code does not constitute a new field test.
