const test = require("node:test");
const assert = require("node:assert/strict");
const Physics = require("../src/resonancePhysics");

test("calculates speed of sound from first-harmonic equation", () => {
  const speed = Physics.calculateSpeedOfSound(320, 0.25, 0.05);
  assert.ok(Math.abs(speed - 339.2) < 1e-12);
});

test("calculates resonant length as inverse of quarter-wave relationship", () => {
  const length = Physics.calculateResonantLength(343, 320, 0.05);
  assert.ok(Math.abs(length - 0.25296875) < 1e-12);
});

test("resonance strength peaks at exact resonance and drops away", () => {
  const exact = Physics.calculateResonanceStrength(0.40, 0.40, 0.02);
  const offset = Physics.calculateResonanceStrength(0.45, 0.40, 0.02);
  assert.equal(exact, 1);
  assert.ok(offset < 0.01);
});

test("maps quality labels by strength range", () => {
  assert.equal(Physics.getQualityLabel(0.95), "Excellent");
  assert.equal(Physics.getQualityLabel(0.8), "Good");
  assert.equal(Physics.getQualityLabel(0.6), "Fair");
  assert.equal(Physics.getQualityLabel(0.2), "Poor");
});

test("computes accepted-trial stats only from accepted valid speeds", () => {
  const stats = Physics.calculateAcceptedStats([
    { accepted: true, speedEstimate: 340 },
    { accepted: false, speedEstimate: 348 },
    { accepted: true, speedEstimate: 344 },
    { accepted: true, speedEstimate: NaN },
  ]);

  assert.equal(stats.acceptedCount, 2);
  assert.equal(stats.totalCount, 4);
  assert.equal(stats.meanSpeed, 342);
});
