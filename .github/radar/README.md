# Radar game mechanics

This is an illustrative gameplay model, not an electromagnetic simulation or a
measurement of real aircraft. It applies a small, smooth aspect-dependent
variation to the existing scenario `stealth` range multiplier. Missing geometry
falls back to that existing multiplier; unknown aircraft use the neutral value 1.

Mission detection and free-flight radar contacts use the same factor. Mission
engagements and SAM launches check detection separately from missile range;
free flight retains its existing launch-zone warnings. The player's IR, TV,
and gun selection does not use the radar factor. The model does not represent
terrain masking, sensor frequency, real RCS, or effects of external stores.

`patch_radar.py` patches the generated site and loads `radar_model.js` before
the mission engine. It runs late in the publish workflow before cache hashing
and access-gate processing. `test_radar.cjs` tests the model and both game modes.
