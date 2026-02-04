(function () {
  "use strict";

  var Physics = window.ResonancePhysics;
  if (!Physics) {
    throw new Error("ResonancePhysics is required before loading app.js");
  }

  var TUBE_DIAMETER_M = 0.05;
  var TRUE_SPEED_MS = 343;
  var LENGTH_STEP = 0.002;
  var MIN_FREQ = 180;
  var MAX_FREQ = 700;

  var state = {
    presetFrequency: 320,
    fineAdjust: 0,
    frequencyHz: 320,
    airColumnLengthM: 0.55,
    trials: [],
    toneOn: false,
  };

  var ui = {
    presetFrequency: document.getElementById("presetFrequency"),
    fineFrequency: document.getElementById("fineFrequency"),
    fineValue: document.getElementById("fineValue"),
    frequencyReadout: document.getElementById("frequencyReadout"),
    moveDown: document.getElementById("moveDown"),
    moveUp: document.getElementById("moveUp"),
    lengthSlider: document.getElementById("lengthSlider"),
    lengthReadout: document.getElementById("lengthReadout"),
    toneToggle: document.getElementById("toneToggle"),
    loudnessMeter: document.getElementById("loudnessMeter"),
    qualityReadout: document.getElementById("qualityReadout"),
    recordTrial: document.getElementById("recordTrial"),
    clearTrials: document.getElementById("clearTrials"),
    acceptedReadout: document.getElementById("acceptedReadout"),
    meanSpeedReadout: document.getElementById("meanSpeedReadout"),
    trialTableBody: document.getElementById("trialTableBody"),
  };

  var audio = {
    context: null,
    oscillator: null,
    gainNode: null,
  };

  function formatNumber(value, digits) {
    return Number(value).toFixed(digits);
  }

  function currentResonance() {
    var resonantLength = Physics.calculateResonantLength(TRUE_SPEED_MS, state.frequencyHz, TUBE_DIAMETER_M);
    var strength = Physics.calculateResonanceStrength(state.airColumnLengthM, resonantLength, 0.02);
    var quality = Physics.getQualityLabel(strength);
    return {
      resonantLength: resonantLength,
      strength: strength,
      quality: quality,
    };
  }

  function updateStateFrequency() {
    var rawFrequency = state.presetFrequency + state.fineAdjust;
    state.frequencyHz = Physics.clamp(rawFrequency, MIN_FREQ, MAX_FREQ);
  }

  function syncAudio(resonance) {
    if (!audio.context || !audio.oscillator || !audio.gainNode) {
      return;
    }

    var now = audio.context.currentTime;
    audio.oscillator.frequency.setTargetAtTime(state.frequencyHz, now, 0.02);

    var targetGain = 0;
    if (state.toneOn) {
      targetGain = Math.pow(resonance.strength, 1.3) * 0.2;
    }
    audio.gainNode.gain.setTargetAtTime(targetGain, now, 0.02);
  }

  function render() {
    var resonance = currentResonance();

    ui.fineValue.textContent = String(state.fineAdjust);
    ui.frequencyReadout.textContent = formatNumber(state.frequencyHz, 1);
    ui.lengthReadout.textContent = formatNumber(state.airColumnLengthM, 3);
    ui.qualityReadout.textContent = resonance.quality;

    ui.qualityReadout.className = "quality-" + resonance.quality.toLowerCase();
    ui.loudnessMeter.style.width = formatNumber(resonance.strength * 100, 1) + "%";

    syncAudio(resonance);
    renderTrials();
  }

  function renderTrials() {
    var stats = Physics.calculateAcceptedStats(state.trials);
    ui.acceptedReadout.textContent = stats.acceptedCount + " / " + stats.totalCount;
    ui.meanSpeedReadout.textContent =
      stats.meanSpeed === null ? "--" : formatNumber(stats.meanSpeed, 1) + " m/s";

    ui.trialTableBody.innerHTML = "";

    for (var i = state.trials.length - 1; i >= 0; i -= 1) {
      var trial = state.trials[i];
      var row = document.createElement("tr");

      row.innerHTML =
        "<td>" +
        trial.id +
        "</td>" +
        "<td>" +
        formatNumber(trial.frequencyHz, 1) +
        "</td>" +
        "<td>" +
        formatNumber(trial.lengthM, 3) +
        "</td>" +
        "<td class='quality-" +
        trial.quality.toLowerCase() +
        "'>" +
        trial.quality +
        (trial.accepted ? "" : " (Rejected)") +
        "</td>" +
        "<td>" +
        formatNumber(trial.speedEstimate, 1) +
        "</td>";

      ui.trialTableBody.appendChild(row);
    }
  }

  function initAudioIfNeeded() {
    if (audio.context) {
      return;
    }
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      ui.toneToggle.disabled = true;
      ui.toneToggle.textContent = "Audio unavailable";
      return;
    }

    audio.context = new AudioCtor();
    audio.oscillator = audio.context.createOscillator();
    audio.gainNode = audio.context.createGain();

    audio.oscillator.type = "sine";
    audio.oscillator.connect(audio.gainNode);
    audio.gainNode.connect(audio.context.destination);

    audio.gainNode.gain.value = 0;
    audio.oscillator.frequency.value = state.frequencyHz;
    audio.oscillator.start();
  }

  function setLength(nextLength) {
    var min = Number(ui.lengthSlider.min);
    var max = Number(ui.lengthSlider.max);
    state.airColumnLengthM = Physics.clamp(nextLength, min, max);
    ui.lengthSlider.value = String(state.airColumnLengthM);
  }

  function setupEvents() {
    ui.presetFrequency.addEventListener("change", function () {
      state.presetFrequency = Number(ui.presetFrequency.value);
      updateStateFrequency();
      render();
    });

    ui.fineFrequency.addEventListener("input", function () {
      state.fineAdjust = Number(ui.fineFrequency.value);
      updateStateFrequency();
      render();
    });

    ui.lengthSlider.addEventListener("input", function () {
      setLength(Number(ui.lengthSlider.value));
      render();
    });

    ui.moveDown.addEventListener("click", function () {
      setLength(state.airColumnLengthM - LENGTH_STEP);
      render();
    });

    ui.moveUp.addEventListener("click", function () {
      setLength(state.airColumnLengthM + LENGTH_STEP);
      render();
    });

    ui.toneToggle.addEventListener("click", function () {
      initAudioIfNeeded();
      if (!audio.context) {
        return;
      }

      if (audio.context.state === "suspended") {
        audio.context.resume();
      }

      state.toneOn = !state.toneOn;
      ui.toneToggle.textContent = state.toneOn ? "Stop Tone" : "Start Tone";
      render();
    });

    ui.recordTrial.addEventListener("click", function () {
      var resonance = currentResonance();
      var trial = {
        id: state.trials.length + 1,
        frequencyHz: state.frequencyHz,
        lengthM: state.airColumnLengthM,
        quality: resonance.quality,
        accepted: Physics.isAcceptedTrial(resonance.strength),
        speedEstimate: Physics.calculateSpeedOfSound(
          state.frequencyHz,
          state.airColumnLengthM,
          TUBE_DIAMETER_M
        ),
      };
      state.trials.push(trial);
      render();
    });

    ui.clearTrials.addEventListener("click", function () {
      state.trials = [];
      render();
    });
  }

  function init() {
    ui.presetFrequency.value = String(state.presetFrequency);
    ui.fineFrequency.value = String(state.fineAdjust);
    ui.lengthSlider.value = String(state.airColumnLengthM);
    updateStateFrequency();
    setupEvents();
    render();
  }

  init();
})();
