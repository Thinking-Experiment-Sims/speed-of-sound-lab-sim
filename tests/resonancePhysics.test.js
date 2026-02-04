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

test("calculates period and four-times-length helpers", () => {
  assert.ok(Math.abs(Physics.calculatePeriod(250) - 0.004) < 1e-12);
  assert.equal(Physics.calculateFourL(0.33), 1.32);
});

test("calculates frequency from length as inverse equation", () => {
  const frequency = Physics.calculateFrequencyFromLength(343, 0.25296875, 0.05);
  assert.ok(Math.abs(frequency - 320) < 1e-9);
});

test("fits a line for 4L vs period points", () => {
  const fit = Physics.linearFit([
    { x: 0.003, y: 1.2 },
    { x: 0.004, y: 1.6 },
    { x: 0.005, y: 2.0 },
  ]);

  assert.ok(fit);
  assert.ok(Math.abs(fit.slope - 400) < 1e-9);
  assert.ok(Math.abs(fit.intercept) < 1e-9);
  assert.ok(Math.abs(fit.r2 - 1) < 1e-12);
});
