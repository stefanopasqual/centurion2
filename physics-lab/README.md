# FDM 2.0 — generic rigid-body verification laboratory (phase 1)

Standalone educational lab. No existing aircraft configuration, control law, mission
logic, weapons, aerodynamic data or production application is imported or modified.
The previous engine remains live; this branch does not change the deploy workflow.

Contract:
- world local ENU, body right-handed XYZ, quaternion Hamilton [x,y,z,w] body to world
- SI: metres, seconds, kilograms, newtons, newton-metres, radians
- constant positive mass and a symmetric positive-definite full inertia tensor about CG
- pure force/moment callbacks, gravity separately in world coordinates
- full-state explicit midpoint, quaternion normalization, finite-value validation
- clock at 120 Hz by default, render rate independent for identical timed inputs
- overrun and discarded time reported explicitly; reset fractional clock on pause

Run: `node --test physics-lab/test.mjs`

The tests are analytic or numerical checks on generic inert bodies only. The
torque-free case is inspired by rigid-body verification methodology; it is NOT a
comparison against the published NASA dataset. No claim of NASA compliance,
aircraft fidelity, real-browser performance or professional certification.

Not included: variable mass, curved Earth, atmosphere/wind/ground models,
civilian reference-aircraft comparison, telemetry export, browser adapter, UI.
These require independent validation before any civilian-only integration.
References: https://nescacademy.nasa.gov/flightsim/2015 and
https://standards.nasa.gov/node/263.
