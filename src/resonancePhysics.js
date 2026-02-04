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

  function calculateFrequencyFromLength(speedOfSoundMS, airColumnLengthM, tubeDiameterM) {
    if (speedOfSoundMS <= 0) {
      throw new Error("Speed of sound must be greater than zero.");
    }
    if (airColumnLengthM < 0) {
      throw new Error("Air-column length cannot be negative.");
    }
    if (tubeDiameterM < 0) {
      throw new Error("Tube diameter cannot be negative.");
    }

    var denominator = 4 * (airColumnLengthM + END_CORRECTION_FACTOR * tubeDiameterM);
    if (denominator <= 0) {
      throw new Error("Invalid denominator for frequency calculation.");
    }
    return speedOfSoundMS / denominator;
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

  function calculateResonantLengthForMode(speedOfSoundMS, frequencyHz, tubeDiameterM, modeOdd) {
    var mode = Number.isInteger(modeOdd) ? modeOdd : 1;
    if (mode <= 0 || mode % 2 === 0) {
      throw new Error("Harmonic mode must be a positive odd integer.");
    }
    return Math.max(
      0,
      (mode * speedOfSoundMS) / (4 * frequencyHz) - END_CORRECTION_FACTOR * tubeDiameterM
    );
  }

  function calculatePeriod(frequencyHz) {
    if (frequencyHz <= 0) {
      throw new Error("Frequency must be greater than zero.");
    }
    return 1 / frequencyHz;
  }

  function calculateFourL(airColumnLengthM) {
    if (airColumnLengthM < 0) {
      throw new Error("Air-column length cannot be negative.");
    }
    return 4 * airColumnLengthM;
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

  function linearFit(points) {
    var safePoints = Array.isArray(points) ? points : [];
    var valid = safePoints.filter(function (point) {
      return (
        point &&
        typeof point === "object" &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y)
      );
    });

    if (valid.length < 2) {
      return null;
    }

    var n = valid.length;
    var sumX = 0;
    var sumY = 0;
    var sumXY = 0;
    var sumXX = 0;

    for (var i = 0; i < n; i += 1) {
      var x = valid[i].x;
      var y = valid[i].y;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    var denominator = n * sumXX - sumX * sumX;
    if (Math.abs(denominator) < 1e-12) {
      return null;
    }

    var slope = (n * sumXY - sumX * sumY) / denominator;
    var intercept = (sumY - slope * sumX) / n;
    var meanY = sumY / n;
    var ssResidual = 0;
    var ssTotal = 0;

    for (var j = 0; j < n; j += 1) {
      var predicted = slope * valid[j].x + intercept;
      var residual = valid[j].y - predicted;
      var centered = valid[j].y - meanY;
      ssResidual += residual * residual;
      ssTotal += centered * centered;
    }

    return {
      slope: slope,
      intercept: intercept,
      r2: ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal,
      count: n,
    };
  }

  return Object.freeze({
    END_CORRECTION_FACTOR: END_CORRECTION_FACTOR,
    clamp: clamp,
    calculateSpeedOfSound: calculateSpeedOfSound,
    calculateFrequencyFromLength: calculateFrequencyFromLength,
    calculateResonantLength: calculateResonantLength,
    calculateResonantLengthForMode: calculateResonantLengthForMode,
    calculatePeriod: calculatePeriod,
    calculateFourL: calculateFourL,
    calculateResonanceStrength: calculateResonanceStrength,
    getQualityLabel: getQualityLabel,
    isAcceptedTrial: isAcceptedTrial,
    calculateAcceptedStats: calculateAcceptedStats,
    linearFit: linearFit,
  });
});
