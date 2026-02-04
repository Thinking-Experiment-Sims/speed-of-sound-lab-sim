# Speed of Sound Lab (Resonance Tube)

This project is a high-school Honors Physics simulation focused on estimating the speed of sound with a resonance tube using first-harmonic resonance.

## Included

- Apparatus view (tube, cylinder/water level, tuning forks)
- Frequency controls (tuning fork presets + fine adjustment)
- Cylinder movement controls (buttons + slider)
- Resonance loudness meter with quality labeling
- Optional advanced mode (add higher harmonics to sound)
- Trial table with optional `4L` and `T = 1/f` columns
- `4L` vs `Period` graph with linear-fit equation display
- Assessment mode:
  - Given frequency, predict resonant length
  - Given resonant length, predict frequency
- Unit tests for core resonance physics helpers

## Run

Open `index.html` in a browser.

## Test

Run from the project root:

```bash
node --test tests/resonancePhysics.test.js
```
