(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.ResonancePhysics = factory();
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  var END_CORRECTION_FACTOR = 0.3;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function calculateSpeedOfSound(frequencyHz, airColumnLengthM, tubeDiameterM) {
    if (frequencyHz <= 0) {
      throw new Error("Frequency must be greater than zero.");
    }
    if (airColumnLengthM < 0) {
      throw new Error("Air-column length cannot be negative.");
    }
    if (tubeDiameterM < 0) {
      throw new Error("Tube diameter cannot be negative.");
    }
    return 4 * frequencyHz * (airColumnLengthM + END_CORRECTION_FACTOR * tubeDiameterM);
  }

  function calculateResonantLength(speedOfSoundMS, frequencyHz, tubeDiameterM) {
    if (speedOfSoundMS <= 0) {
      throw new Error("Speed of sound must be greater than zero.");
    }
    if (frequencyHz <= 0) {
      throw new Error("Frequency must be greater than zero.");
    }
    if (tubeDiameterM < 0) {
      throw new Error("Tube diameter cannot be negative.");
    }
    return Math.max(0, speedOfSoundMS / (4 * frequencyHz) - END_CORRECTION_FACTOR * tubeDiameterM);
  }

  function calculateResonanceStrength(observedLengthM, resonantLengthM, toleranceM) {
    var tolerance = toleranceM > 0 ? toleranceM : 0.02;
    var delta = Math.abs(observedLengthM - resonantLengthM);
    var normalizedDelta = delta / tolerance;
    return clamp(Math.exp(-(normalizedDelta * normalizedDelta)), 0, 1);
  }

  function getQualityLabel(strength) {
    if (strength >= 0.9) {
      return "Excellent";
    }
    if (strength >= 0.75) {
      return "Good";
    }
    if (strength >= 0.5) {
      return "Fair";
    }
    return "Poor";
  }

  function isAcceptedTrial(strength, threshold) {
    var minThreshold = typeof threshold === "number" ? threshold : 0.75;
    return strength >= minThreshold;
  }

  function calculateAcceptedStats(trials) {
    var safeTrials = Array.isArray(trials) ? trials : [];
    var accepted = safeTrials.filter(function (trial) {
      return Boolean(trial.accepted) && Number.isFinite(trial.speedEstimate);
    });

    if (accepted.length === 0) {
      return {
        acceptedCount: 0,
        totalCount: safeTrials.length,
        meanSpeed: null,
      };
    }

    var sum = accepted.reduce(function (acc, trial) {
      return acc + trial.speedEstimate;
    }, 0);

    return {
      acceptedCount: accepted.length,
      totalCount: safeTrials.length,
      meanSpeed: sum / accepted.length,
    };
  }

  return Object.freeze({
    END_CORRECTION_FACTOR: END_CORRECTION_FACTOR,
    clamp: clamp,
    calculateSpeedOfSound: calculateSpeedOfSound,
    calculateResonantLength: calculateResonantLength,
    calculateResonanceStrength: calculateResonanceStrength,
    getQualityLabel: getQualityLabel,
    isAcceptedTrial: isAcceptedTrial,
    calculateAcceptedStats: calculateAcceptedStats,
  });
});
