(function () {
  "use strict";

  var Physics = window.ResonancePhysics;
  if (!Physics) {
    throw new Error("ResonancePhysics is required before loading app.js");
  }

  var PRESET_FREQUENCIES = [256, 288, 320, 341, 384, 426, 480];
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
    advancedMode: false,
    harmonicBlend: 1,
    fitResult: null,
    assessment: null,
  };

  var ui = {
    forkRack: document.getElementById("forkRack"),
    forkButtons: Array.from(document.querySelectorAll(".fork-btn")),
    fineFrequency: document.getElementById("fineFrequency"),
    fineValue: document.getElementById("fineValue"),
    frequencyReadout: document.getElementById("frequencyReadout"),
    moveDown: document.getElementById("moveDown"),
    moveUp: document.getElementById("moveUp"),
    lengthSlider: document.getElementById("lengthSlider"),
    lengthReadout: document.getElementById("lengthReadout"),
    toneToggle: document.getElementById("toneToggle"),
    advancedMode: document.getElementById("advancedMode"),
    harmonicBlend: document.getElementById("harmonicBlend"),
    loudnessMeter: document.getElementById("loudnessMeter"),
    qualityReadout: document.getElementById("qualityReadout"),
    showFourL: document.getElementById("showFourL"),
    showPeriod: document.getElementById("showPeriod"),
    recordTrial: document.getElementById("recordTrial"),
    fitLine: document.getElementById("fitLine"),
    clearTrials: document.getElementById("clearTrials"),
    acceptedReadout: document.getElementById("acceptedReadout"),
    fitReadout: document.getElementById("fitReadout"),
    fitCanvas: document.getElementById("fitCanvas"),
    trialTableHead: document.getElementById("trialTableHead"),
    trialTableBody: document.getElementById("trialTableBody"),
    waterColumn: document.getElementById("waterColumn"),
    cylinderPlate: document.getElementById("cylinderPlate"),
    waterLineGuide: document.getElementById("waterLineGuide"),
    waterLabel: document.getElementById("waterLabel"),
    assessmentType: document.getElementById("assessmentType"),
    newChallenge: document.getElementById("newChallenge"),
    checkAnswer: document.getElementById("checkAnswer"),
    assessmentPrompt: document.getElementById("assessmentPrompt"),
    assessmentInput: document.getElementById("assessmentInput"),
    assessmentFeedback: document.getElementById("assessmentFeedback"),
  };

  var audio = {
    context: null,
    oscillators: [],
    gains: [],
    masterGain: null,
  };

  function formatNumber(value, digits) {
    return Number(value).toFixed(digits);
  }

  function currentResonance() {
    var resonantLength = Physics.calculateResonantLength(TRUE_SPEED_MS, state.frequencyHz, TUBE_DIAMETER_M);
    var strength = Physics.calculateResonanceStrength(state.airColumnLengthM, resonantLength, 0.018);
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
    if (!audio.context || audio.oscillators.length === 0) {
      return;
    }

    var now = audio.context.currentTime;
    var baseGain = state.toneOn ? Math.pow(resonance.strength, 1.3) : 0;
    var harmonicCap = state.advancedMode ? state.harmonicBlend : 1;

    for (var i = 0; i < audio.oscillators.length; i += 1) {
      var multiplier = 2 * i + 1;
      audio.oscillators[i].frequency.setTargetAtTime(state.frequencyHz * multiplier, now, 0.02);

      var enabled = multiplier <= harmonicCap;
      var weight = i === 0 ? 1 : i === 1 ? 0.45 : 0.25;
      var gainValue = enabled ? baseGain * weight : 0;
      audio.gains[i].gain.setTargetAtTime(gainValue, now, 0.03);
    }

    audio.masterGain.gain.setTargetAtTime(0.2, now, 0.03);
  }

  function render() {
    var resonance = currentResonance();

    ui.fineValue.textContent = String(state.fineAdjust);
    ui.frequencyReadout.textContent = formatNumber(state.frequencyHz, 1);
    ui.lengthReadout.textContent = formatNumber(state.airColumnLengthM, 3);
    ui.qualityReadout.textContent = resonance.quality;

    ui.qualityReadout.className = "quality-" + resonance.quality.toLowerCase();
    ui.loudnessMeter.style.width = formatNumber(resonance.strength * 100, 1) + "%";
    ui.harmonicBlend.disabled = !state.advancedMode;

    updateForkButtons();
    updateApparatusView();
    syncAudio(resonance);
    renderTrials();
    drawGraph();
  }

  function updateForkButtons() {
    for (var i = 0; i < ui.forkButtons.length; i += 1) {
      var button = ui.forkButtons[i];
      var isActive = Number(button.dataset.frequency) === state.presetFrequency;
      button.classList.toggle("is-active", isActive);
    }
  }

  function updateApparatusView() {
    var yTop = 44;
    var yBottom = 376;
    var min = Number(ui.lengthSlider.min);
    var max = Number(ui.lengthSlider.max);
    var ratio = (state.airColumnLengthM - min) / (max - min);
    var surfaceY = yTop + ratio * (yBottom - yTop);
    var waterHeight = yBottom - surfaceY;

    ui.waterColumn.setAttribute("y", formatNumber(surfaceY, 2));
    ui.waterColumn.setAttribute("height", formatNumber(waterHeight, 2));
    ui.cylinderPlate.setAttribute("y", formatNumber(surfaceY - 10, 2));
    ui.waterLineGuide.setAttribute("y1", formatNumber(surfaceY, 2));
    ui.waterLineGuide.setAttribute("y2", formatNumber(surfaceY, 2));
    ui.waterLabel.setAttribute("y", formatNumber(surfaceY + 4, 2));
  }

  function getTableColumns() {
    var columns = [
      { id: "id", label: "#" },
      { id: "frequency", label: "f (Hz)" },
      { id: "length", label: "L (m)" },
      { id: "quality", label: "Quality" },
    ];

    if (ui.showFourL.checked) {
      columns.push({ id: "fourL", label: "4L (m)" });
    }
    if (ui.showPeriod.checked) {
      columns.push({ id: "period", label: "T (s)" });
    }
    return columns;
  }

  function renderTrials() {
    var acceptedCount = state.trials.filter(function (trial) {
      return trial.accepted;
    }).length;
    ui.acceptedReadout.textContent = acceptedCount + " / " + state.trials.length;

    if (state.fitResult) {
      ui.fitReadout.textContent =
        "4L = " +
        formatNumber(state.fitResult.slope, 2) +
        "T + " +
        formatNumber(state.fitResult.intercept, 3) +
        " (R²=" +
        formatNumber(state.fitResult.r2, 3) +
        ")";
    } else {
      ui.fitReadout.textContent = "4L = --";
    }

    var columns = getTableColumns();
    var headerRow = columns
      .map(function (column) {
        return "<th>" + column.label + "</th>";
      })
      .join("");
    ui.trialTableHead.innerHTML = "<tr>" + headerRow + "</tr>";
    ui.trialTableBody.innerHTML = "";

    for (var i = state.trials.length - 1; i >= 0; i -= 1) {
      var trial = state.trials[i];
      var row = document.createElement("tr");
      var cells = [];
      for (var j = 0; j < columns.length; j += 1) {
        var id = columns[j].id;
        if (id === "id") {
          cells.push("<td>" + trial.id + "</td>");
        } else if (id === "frequency") {
          cells.push("<td>" + formatNumber(trial.frequencyHz, 1) + "</td>");
        } else if (id === "length") {
          cells.push("<td>" + formatNumber(trial.lengthM, 3) + "</td>");
        } else if (id === "quality") {
          cells.push(
            "<td class='quality-" +
              trial.quality.toLowerCase() +
              "'>" +
              trial.quality +
              (trial.accepted ? "" : " (Rejected)") +
              "</td>"
          );
        } else if (id === "fourL") {
          cells.push("<td>" + formatNumber(trial.fourL, 3) + "</td>");
        } else if (id === "period") {
          cells.push("<td>" + formatNumber(trial.period, 5) + "</td>");
        }
      }
      row.innerHTML = cells.join("");

      ui.trialTableBody.appendChild(row);
    }
  }

  function getGraphPoints() {
    return state.trials
      .filter(function (trial) {
        return trial.accepted;
      })
      .map(function (trial) {
        return { x: trial.period, y: trial.fourL };
      });
  }

  function drawGraph() {
    var canvas = ui.fitCanvas;
    if (!canvas) {
      return;
    }

    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    var points = getGraphPoints();
    var padLeft = 56;
    var padRight = 20;
    var padTop = 20;
    var padBottom = 42;
    var plotWidth = width - padLeft - padRight;
    var plotHeight = height - padTop - padBottom;

    ctx.strokeStyle = "#9ab0ba";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, height - padBottom);
    ctx.lineTo(width - padRight, height - padBottom);
    ctx.stroke();

    ctx.fillStyle = "#3f606c";
    ctx.font = '12px "Avenir Next", sans-serif';
    ctx.fillText("4L (m)", 10, padTop + 8);
    ctx.fillText("T (s)", width - padRight - 24, height - 12);

    if (points.length < 2) {
      ctx.fillStyle = "#4f6f7a";
      ctx.fillText("Need at least 2 accepted trials to graph and fit.", padLeft + 12, padTop + 22);
      return;
    }

    var minX = Math.min.apply(
      null,
      points.map(function (p) {
        return p.x;
      })
    );
    var maxX = Math.max.apply(
      null,
      points.map(function (p) {
        return p.x;
      })
    );
    var minY = Math.min.apply(
      null,
      points.map(function (p) {
        return p.y;
      })
    );
    var maxY = Math.max.apply(
      null,
      points.map(function (p) {
        return p.y;
      })
    );

    var xPad = Math.max((maxX - minX) * 0.15, 0.0002);
    var yPad = Math.max((maxY - minY) * 0.15, 0.04);
    minX -= xPad;
    maxX += xPad;
    minY -= yPad;
    maxY += yPad;

    function xScale(x) {
      return padLeft + ((x - minX) / (maxX - minX)) * plotWidth;
    }

    function yScale(y) {
      return padTop + (1 - (y - minY) / (maxY - minY)) * plotHeight;
    }

    ctx.strokeStyle = "#c0cfd6";
    ctx.fillStyle = "#4f6f7a";
    ctx.textAlign = "center";
    for (var i = 0; i <= 4; i += 1) {
      var xTick = minX + (i / 4) * (maxX - minX);
      var xPos = xScale(xTick);
      ctx.beginPath();
      ctx.moveTo(xPos, height - padBottom);
      ctx.lineTo(xPos, padTop);
      ctx.stroke();
      ctx.fillText(formatNumber(xTick, 4), xPos, height - padBottom + 16);
    }
    ctx.textAlign = "right";
    for (var j = 0; j <= 4; j += 1) {
      var yTick = minY + (j / 4) * (maxY - minY);
      var yPos = yScale(yTick);
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(width - padRight, yPos);
      ctx.stroke();
      ctx.fillText(formatNumber(yTick, 2), padLeft - 6, yPos + 4);
    }
    ctx.textAlign = "left";

    ctx.fillStyle = "#0f8b8d";
    for (var p = 0; p < points.length; p += 1) {
      ctx.beginPath();
      ctx.arc(xScale(points[p].x), yScale(points[p].y), 4.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.fitResult) {
      var yStart = state.fitResult.slope * minX + state.fitResult.intercept;
      var yEnd = state.fitResult.slope * maxX + state.fitResult.intercept;
      ctx.strokeStyle = "#d1495b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xScale(minX), yScale(yStart));
      ctx.lineTo(xScale(maxX), yScale(yEnd));
      ctx.stroke();
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
    audio.masterGain = audio.context.createGain();
    audio.masterGain.gain.value = 0.2;
    audio.masterGain.connect(audio.context.destination);

    for (var i = 0; i < 3; i += 1) {
      var osc = audio.context.createOscillator();
      var gain = audio.context.createGain();
      osc.type = "sine";
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(audio.masterGain);
      osc.start();
      audio.oscillators.push(osc);
      audio.gains.push(gain);
    }
  }

  function setLength(nextLength) {
    var min = Number(ui.lengthSlider.min);
    var max = Number(ui.lengthSlider.max);
    state.airColumnLengthM = Physics.clamp(nextLength, min, max);
    ui.lengthSlider.value = String(state.airColumnLengthM);
  }

  function setupEvents() {
    ui.forkRack.addEventListener("click", function (event) {
      var button = event.target.closest(".fork-btn");
      if (!button) {
        return;
      }
      state.presetFrequency = Number(button.dataset.frequency);
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

    ui.advancedMode.addEventListener("change", function () {
      state.advancedMode = ui.advancedMode.checked;
      render();
    });

    ui.harmonicBlend.addEventListener("change", function () {
      state.harmonicBlend = Number(ui.harmonicBlend.value);
      render();
    });

    ui.showFourL.addEventListener("change", render);
    ui.showPeriod.addEventListener("change", render);

    ui.recordTrial.addEventListener("click", function () {
      var resonance = currentResonance();
      var trial = {
        id: state.trials.length + 1,
        frequencyHz: state.frequencyHz,
        lengthM: state.airColumnLengthM,
        quality: resonance.quality,
        accepted: Physics.isAcceptedTrial(resonance.strength),
        fourL: Physics.calculateFourL(state.airColumnLengthM),
        period: Physics.calculatePeriod(state.frequencyHz),
      };
      state.trials.push(trial);
      state.fitResult = null;
      render();
    });

    ui.fitLine.addEventListener("click", function () {
      var fit = Physics.linearFit(getGraphPoints());
      state.fitResult = fit;
      render();
      if (!fit) {
        ui.fitReadout.textContent = "Need at least 2 accepted trials for fit.";
      }
    });

    ui.clearTrials.addEventListener("click", function () {
      state.trials = [];
      state.fitResult = null;
      render();
    });

    ui.newChallenge.addEventListener("click", function () {
      createAssessmentChallenge();
    });

    ui.checkAnswer.addEventListener("click", function () {
      checkAssessmentAnswer();
    });
  }

  function randomChoice(items) {
    var index = Math.floor(Math.random() * items.length);
    return items[index];
  }

  function createAssessmentChallenge() {
    var type = ui.assessmentType.value;
    if (type === "random") {
      type = Math.random() < 0.5 ? "lengthFromFrequency" : "frequencyFromLength";
    }

    if (type === "lengthFromFrequency") {
      var freq = randomChoice(PRESET_FREQUENCIES) + (Math.floor(Math.random() * 7) - 3);
      var targetLength = Physics.calculateResonantLength(TRUE_SPEED_MS, freq, TUBE_DIAMETER_M);
      state.assessment = {
        type: type,
        answer: targetLength,
        tolerance: 0.015,
        unit: "m",
        prompt:
          "Given frequency f = " +
          formatNumber(freq, 1) +
          " Hz, predict first-harmonic resonant L (m).",
      };
      ui.assessmentInput.step = "0.001";
      ui.assessmentInput.placeholder = "meters";
    } else {
      var length = 0.2 + Math.random() * 0.8;
      var roundedLength = Number(formatNumber(length, 3));
      var targetFrequency = Physics.calculateFrequencyFromLength(
        TRUE_SPEED_MS,
        roundedLength,
        TUBE_DIAMETER_M
      );
      state.assessment = {
        type: type,
        answer: targetFrequency,
        tolerance: 8,
        unit: "Hz",
        prompt:
          "Given resonant length L = " +
          formatNumber(roundedLength, 3) +
          " m, predict frequency f (Hz).",
      };
      ui.assessmentInput.step = "0.1";
      ui.assessmentInput.placeholder = "hertz";
    }

    ui.assessmentPrompt.textContent = state.assessment.prompt;
    ui.assessmentInput.value = "";
    ui.assessmentFeedback.textContent = "";
  }

  function checkAssessmentAnswer() {
    if (!state.assessment) {
      ui.assessmentFeedback.textContent = "Create a challenge first.";
      return;
    }

    var guess = Number(ui.assessmentInput.value);
    if (!Number.isFinite(guess)) {
      ui.assessmentFeedback.textContent = "Enter a numeric prediction first.";
      return;
    }

    var error = Math.abs(guess - state.assessment.answer);
    var isCorrect = error <= state.assessment.tolerance;
    if (isCorrect) {
      ui.assessmentFeedback.textContent =
        "Correct range. Error: " +
        formatNumber(error, 3) +
        " " +
        state.assessment.unit +
        ".";
      return;
    }

    ui.assessmentFeedback.textContent =
      "Not yet. Error: " +
      formatNumber(error, 3) +
      " " +
      state.assessment.unit +
      ". Target: " +
      formatNumber(state.assessment.answer, state.assessment.unit === "m" ? 3 : 1) +
      " " +
      state.assessment.unit +
      ".";
  }

  function init() {
    ui.fineFrequency.value = String(state.fineAdjust);
    ui.lengthSlider.value = String(state.airColumnLengthM);
    ui.advancedMode.checked = false;
    ui.harmonicBlend.value = "1";
    ui.showFourL.checked = true;
    ui.showPeriod.checked = true;
    updateStateFrequency();
    setupEvents();
    render();
  }

  init();
})();
