# Speed of Sound Lab (Resonance Tube)

This project is a high-school Honors Physics simulation focused on estimating the speed of sound with a resonance tube using first-harmonic resonance.

## Included

- Frequency controls (preset + fine adjustment)
- Air-column movement controls (buttons + slider)
- Resonance loudness meter with quality labeling
- Web Audio tone playback tied to resonance strength
- Trial recording table with accepted-trial stats
- Physics helpers based on:
  - `v = 4f(L + 0.3D)`
- Unit tests for core resonance physics helpers

## Run

Open `index.html` in a browser.

## Test

Run from the project root:

```bash
node --test tests/resonancePhysics.test.js
```
