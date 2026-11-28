# FDM 2.1 — generic rigid-body verification laboratory

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

Run: `node --test physics-lab/test.mjs physics-lab/advanced.test.mjs`

The tests are analytic or numerical checks on generic inert bodies only. The
torque-free case is inspired by rigid-body verification methodology; it is NOT a
comparison against the published NASA dataset. No claim of NASA compliance,
aircraft fidelity, real-browser performance or professional certification.

Not included: variable mass, curved Earth, atmosphere/wind/ground models,
civilian reference-aircraft comparison, telemetry export, browser adapter, UI.
These require independent validation before any civilian-only integration.
References: https://nescacademy.nasa.gov/flightsim/2015 and
https://standards.nasa.gov/node/263.

## Advanced verification

Physical inertia is the default (use {physical:false} only for mathematical experiments).
The scaled symmetry and principal-minor tolerance is 1e-12; the infinity-norm
condition number limit is 1e10. These are laboratory policy limits, not NASA standards.
State passed to force providers is read-only; external nondeterminism remains a provider
responsibility. The clock is deterministic with respect to accepted ticks, not wall time
when overloaded. The expanded tests include seeded rotation identities, a closed-form
symmetric top, a separately coded matrix RK4 reference, intermediate-axis motion,
continuous invariant envelopes over 120 minutes, and jitter/overrun accounting.
The RK4 reference uses generic inert objects and is not a production integrator.
The official NESC atmospheric case 02 includes WGS-84 rotation and J2 gravity;
its full dataset is not yet compared. Browser and mobile measurements remain outstanding.
