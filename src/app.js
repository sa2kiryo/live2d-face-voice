import { GESTURES } from "./gestures.js";

// 自分のモデルに差し替えるときはここを編集します。詳細は README の
// 「自分のモデルを使う」セクションを参照。
const MODELS = [
  {
    id: "luna",
    label: "Luna",
    dir: "./model/luna",
    file: "luna.model3.json",
    expressions: [
      { id: "smile", label: "笑顔", key: "F1", file: "expression/smile.exp3.json" },
      { id: "angry", label: "怒り", key: "F2", file: "expression/angry.exp3.json" },
      { id: "sad", label: "悲しみ", key: "F3", file: "expression/sad.exp3.json" },
      { id: "surprise", label: "驚き", key: "F4", file: "expression/surprise.exp3.json" },
      { id: "cheek", label: "照れ", key: "F5", file: "expression/cheek.exp3.json" },
    ],
  },
];

const DEFAULT_MODEL_ID = "luna";

const DEFAULT_BACKGROUND_COLOR = "#111412";
const BACKGROUND_STORAGE_KEY = "stage-background-color";
const SMOOTHING_ALPHA = 0.32;
const DEFAULT_POSE_BIAS = {
  bodyTurn: 0,
  headTurnAssist: 0,
};
const POSE_BIAS_STORAGE_KEY = "pose-bias";
const POSE_BIAS_RANGES = {
  bodyTurn: [-10, 10],
  headTurnAssist: [-30, 30],
};

const MOUTH_GAIN = 1.4;
const HEAD_SWAY_GAIN = 0.5;
const GAZE_INTENSITY = 0.55;

const CDN = {
  cubismCore: "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
  pixi: "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js",
  live2d: "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js",
};

const LOCAL_VENDOR = {
  cubismCore: "./vendor/live2dcubismcore.min.js",
  pixi: "./vendor/pixi.min.js",
  live2d: "./vendor/pixi-live2d-display-cubism4.min.js",
};

const DEFAULT_PARAMS = {
  ParamAngleX: 0,
  ParamAngleY: 0,
  ParamAngleZ: 0,
  ParamBodyAngleX: 0,
  ParamBodyAngleY: 0,
  ParamBodyAngleZ: 0,
  ParamMouthForm: 0,
  ParamMouthOpenY: 0,
  ParamEyeLOpen: 1,
  ParamEyeROpen: 1,
  ParamEyeLSmile: 0,
  ParamEyeRSmile: 0,
  ParamEyeBallX: 0,
  ParamEyeBallY: 0,
  ParamBrowLY: 0,
  ParamBrowRY: 0,
  ParamBrowLAngle: 0,
  ParamBrowRAngle: 0,
  ParamBrowLForm: 0,
  ParamBrowRForm: 0,
  ParamCheek: 0,
  Param: 0,
};

const PARAM_RANGES = {
  ParamAngleX: [-30, 30],
  ParamAngleY: [-30, 30],
  ParamAngleZ: [-30, 30],
  ParamBodyAngleX: [-10, 10],
  ParamBodyAngleY: [-10, 10],
  ParamBodyAngleZ: [-10, 10],
  ParamMouthForm: [-1, 1],
  ParamMouthOpenY: [0, 2.1],
  ParamEyeLOpen: [0, 1.9],
  ParamEyeROpen: [0, 1.9],
  ParamEyeLSmile: [0, 1],
  ParamEyeRSmile: [0, 1],
  ParamEyeBallX: [-1, 1],
  ParamEyeBallY: [-1, 1],
  ParamBrowLY: [-1, 1],
  ParamBrowRY: [-1, 1],
  ParamBrowLAngle: [-1, 1],
  ParamBrowRAngle: [-1, 1],
  ParamBrowLForm: [-1, 1],
  ParamBrowRForm: [-1, 1],
  ParamCheek: [0, 1],
  Param: [-1, 1],
};

// Continuous body posture per expression. Added on top of audio-driven sway so
// the body keeps swaying naturally while leaning into the emotion.
const EXPRESSION_BODY_POSTURE = {
  smile: { ParamBodyAngleY: 2.5, ParamBodyAngleZ: 1.5, ParamAngleZ: 2 },
  angry: { ParamBodyAngleY: -3.5, ParamAngleY: -3, ParamBodyAngleX: 2 },
  sad: { ParamBodyAngleY: -5, ParamAngleY: -4, ParamAngleZ: -3 },
  surprise: { ParamBodyAngleY: 5, ParamAngleY: 5, ParamBodyAngleZ: 1.5 },
  cheek: { ParamBodyAngleZ: 2.5, ParamAngleZ: 3.5, ParamBodyAngleX: -1.5 },
};
const EXPRESSION_POSTURE_SMOOTHING = 0.06;

// Bust (上半身) framing — full-body framing is no longer supported.
const FRAME_PRESET = {
  scaleFromHeight: 1.62,
  scaleFromWidth: 0.9,
  x: 0.5,
  y: 0.94,
};

const dom = {
  stage: document.querySelector("#stage"),
  canvas: document.querySelector("#live2d-canvas"),
  overlay: document.querySelector("#load-overlay"),
  loadMessage: document.querySelector("#load-message"),
  errorBox: document.querySelector("#error-box"),
  resetPose: document.querySelector("#reset-pose"),
  bodyTurn: document.querySelector("#body-turn"),
  bodyTurnValue: document.querySelector("#body-turn-value"),
  headTurnAssist: document.querySelector("#head-turn-assist"),
  headTurnAssistValue: document.querySelector("#head-turn-assist-value"),
  clearExpression: document.querySelector("#clear-expression"),
  expressionGrid: document.querySelector("#expression-grid"),
  backgroundButtons: document.querySelectorAll("[data-background-color]"),
  backgroundCustom: document.querySelector("#background-custom"),
  runtimeStatus: document.querySelector("#runtime-status"),
  modelStatus: document.querySelector("#model-status"),
  audioStatus: document.querySelector("#audio-status"),
  audioFile: document.querySelector("#audio-file"),
  audioPick: document.querySelector("#audio-pick"),
  audioPlay: document.querySelector("#audio-play"),
  audioStop: document.querySelector("#audio-stop"),
  audioClear: document.querySelector("#audio-clear"),
  audioMeta: document.querySelector("#audio-meta"),
  audioAnalyze: document.querySelector("#audio-analyze"),
  audioExportMp4: document.querySelector("#audio-export-mp4"),
  recordingIndicator: document.querySelector("#recording-indicator"),
  recordingTimer: document.querySelector("#recording-timer"),
  emotionMode: document.querySelector("#emotion-mode"),
  analysisMeta: document.querySelector("#analysis-meta"),
  transcriptPanel: document.querySelector("#transcript-panel"),
  transcriptList: document.querySelector("#transcript-list"),
  modelLabel: document.querySelector("#model-label"),
};

const state = {
  app: null,
  model: null,
  modelSpec: null,
  modelReady: false,
  runtimeReady: false,
  activeExpression: null,
  expressions: new Map(),
  expressionParamIds: new Set(),
  smoothed: { ...DEFAULT_PARAMS },
  parameterSetter: null,
  parameterWarningShown: false,
  modelDefaults: {},
  curatedDefaults: { ...DEFAULT_PARAMS },
  audio: {
    enabled: false,
    context: null,
    analyser: null,
    bufferSource: null,
    decodedBuffer: null,
    rafId: 0,
    freqData: null,
    timeData: null,
    fileName: "",
    startedAt: 0,
    blinkPhase: 0,
    blinkTimer: 0,
    nextBlinkAt: 200,
    blinkFactor: 1,
    activityLevel: 0,
    idleGazeX: 0,
    idleGazeY: 0,
    idleGazeTargetX: 0,
    idleGazeTargetY: 0,
    idleGazeFrames: 9999,
    idleGazeNextAt: 0,
    mouthEnvelope: 0,
    onEndedCallback: null,
  },
  recording: {
    instance: null,
    timerId: 0,
    startedAt: 0,
  },
  audioParams: {
    ParamMouthOpenY: 0,
    ParamMouthForm: 0,
    ParamAngleX: 0,
    ParamAngleY: 0,
    ParamAngleZ: 0,
    ParamBodyAngleX: 0,
    ParamBodyAngleY: 0,
    ParamBodyAngleZ: 0,
    ParamEyeBallX: 0,
    ParamEyeBallY: 0,
  },
  headSway: { phase: Math.random() * 1000, level: 0 },
  expressionPosture: {},
  analysis: {
    busy: false,
    segments: [],
    events: [],
    cursor: 0,
    enabled: false,
  },
  activeGesture: null,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,
  poseBias: { ...DEFAULT_POSE_BIAS },
};

boot();

function boot() {
  renderExpressionButtons();
  bindControls();
  setStageBackground(readSavedBackgroundColor(), { persist: false });
  setPoseBias(readSavedPoseBias(), { persist: false });
  updateRangeOutputs();
  initializeLive2D();
}

async function initializeLive2D() {
  try {
    showLoading("Runtime を読み込み中");
    await loadRuntime();
    setChip(dom.runtimeStatus, "ready", "Ready");

    const PIXI = window.PIXI;
    state.app = new PIXI.Application({
      view: dom.canvas,
      resizeTo: dom.stage,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      antialias: true,
      backgroundAlpha: 1,
      backgroundColor: hexToNumber(state.backgroundColor),
      powerPreference: "high-performance",
      // VideoFrame(canvas) で空フレームを掴まないように WebGL の back buffer を保持
      preserveDrawingBuffer: true,
    });
    applyRendererBackground(state.backgroundColor);
    state.app.ticker.add(() => {
      updateModelParameters();
      updateModelFraming();
    });
    window.addEventListener("resize", fitModelToStage);
    new ResizeObserver(fitModelToStage).observe(dom.stage);

    await loadModel(DEFAULT_MODEL_ID);
  } catch (error) {
    setChip(dom.modelStatus, "error", "Error");
    setChip(dom.runtimeStatus, state.runtimeReady ? "ready" : "error", state.runtimeReady ? "Ready" : "Error");
    showError(formatError(error));
    showLoading("読み込み失敗");
  }
}

async function loadModel(id) {
  const spec = MODELS.find((m) => m.id === id);
  if (!spec) return;
  if (!state.app) return;

  if (state.audio.enabled) disableAudioMode();
  setExpression(null);

  setChip(dom.modelStatus, "loading", "Loading");
  showLoading(`${spec.label} を読み込み中`);
  state.modelReady = false;

  if (state.model) {
    try {
      state.app.stage.removeChild(state.model);
      state.model.destroy({ children: true, baseTexture: false });
    } catch (error) {
      console.warn("model destroy failed", error);
    }
    state.model = null;
    state.parameterSetter = null;
  }
  state.expressions.clear();
  state.expressionParamIds = new Set();
  state.smoothed = { ...DEFAULT_PARAMS };
  state.expressionPosture = {};
  state.modelSpec = spec;

  try {
    const Live2DModel = window.PIXI.live2d.Live2DModel;
    const url = encodeURI(`${spec.dir}/${spec.file}`);
    state.model = await Live2DModel.from(url, { autoInteract: false });
    state.app.stage.addChild(state.model);
    state.model.anchor.set(0.5, 0.52);
    state.parameterSetter = createParameterSetter(state.model);
    state.modelDefaults = snapshotModelDefaults(state.model);
    state.curatedDefaults = buildCuratedDefaults(state.modelDefaults);
    state.smoothed = { ...state.curatedDefaults };
    fitModelToStage();

    await loadExpressions();
    renderExpressionButtons();

    state.modelReady = true;
    setChip(dom.modelStatus, "ready", "Ready");
    hideLoading();

    if (dom.modelLabel) dom.modelLabel.textContent = spec.label;
  } catch (error) {
    setChip(dom.modelStatus, "error", "Error");
    showError(formatError(error));
    showLoading("読み込み失敗");
  }
}

async function loadRuntime() {
  await loadScript(await resolveLocalFirst(LOCAL_VENDOR.cubismCore, CDN.cubismCore));
  await loadScript(await resolveLocalFirst(LOCAL_VENDOR.pixi, CDN.pixi));
  if (!window.PIXI) {
    throw new Error("PixiJS was loaded, but the PIXI global is unavailable.");
  }
  await loadScript(await resolveLocalFirst(LOCAL_VENDOR.live2d, CDN.live2d));

  if (!window.PIXI?.live2d?.Live2DModel) {
    throw new Error("Live2D runtime was loaded, but Live2DModel is unavailable.");
  }
  state.runtimeReady = true;
}

async function assetExists(url) {
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function resolveLocalFirst(localUrl, remoteUrl) {
  return (await assetExists(localUrl)) ? localUrl : remoteUrl;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.crossOrigin = src.startsWith("http") ? "anonymous" : "";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script load failed: ${src}`));
    document.head.appendChild(script);
  });
}

function fitModelToStage() {
  updateModelFraming(true);
}

function updateModelFraming(immediate = false) {
  if (!state.app || !state.model) return;

  const screen = state.app.screen;
  const modelWidth = state.model.internalModel?.width || state.model.width || 1;
  const modelHeight = state.model.internalModel?.height || state.model.height || 1;
  const scaleByHeight = (screen.height / modelHeight) * FRAME_PRESET.scaleFromHeight;
  const scaleByWidth = (screen.width / modelWidth) * FRAME_PRESET.scaleFromWidth;
  const finalScale = Math.max(scaleByHeight, scaleByWidth);
  state.model.scale.set(finalScale);

  // anchor.y is 0.52 → 52% of the scaled model is above the anchor.
  // On wide stages, scaleByWidth can push the head above the visible area;
  // clamp y so the face top stays at >= FACE_TOP_MARGIN.
  const ANCHOR_Y = 0.52;
  const FACE_TOP_MARGIN = 0.04;
  const desiredYRatio = FRAME_PRESET.y;
  const minYRatioForFace =
    (ANCHOR_Y * modelHeight * finalScale + FACE_TOP_MARGIN * screen.height) / screen.height;
  const yRatio = Math.max(desiredYRatio, minYRatioForFace);

  state.model.position.set(screen.width * FRAME_PRESET.x, screen.height * yRatio);
  void immediate;
}

async function loadExpressions() {
  if (!state.modelSpec) return;
  const spec = state.modelSpec;
  const results = await Promise.allSettled(
    spec.expressions.map(async (expression) => {
      const response = await fetch(encodeURI(`${spec.dir}/${expression.file}`));
      if (!response.ok) {
        throw new Error(`${expression.file}: ${response.status}`);
      }
      const data = await response.json();
      state.expressions.set(expression.id, data);
    }),
  );

  state.expressionParamIds = new Set();
  for (const data of state.expressions.values()) {
    for (const p of data?.Parameters || []) {
      if (p?.Id) state.expressionParamIds.add(p.Id);
    }
  }

  if (results.some((result) => result.status === "rejected")) {
    setChip(dom.modelStatus, "warn", "No expressions");
  }
}

function renderExpressionButtons() {
  dom.expressionGrid.replaceChildren();
  if (!state.modelSpec) return;
  for (const expression of state.modelSpec.expressions) {
    const button = document.createElement("button");
    button.className = "expression-button";
    button.type = "button";
    button.textContent = expression.label;
    button.title = expression.key;
    button.dataset.expression = expression.id;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => toggleExpression(expression.id));
    dom.expressionGrid.append(button);
  }
}

function bindControls() {
  dom.resetPose.addEventListener("click", resetPose);
  dom.clearExpression.addEventListener("click", () => setExpression(null));

  dom.bodyTurn.addEventListener("input", () => {
    setPoseBias({ bodyTurn: Number(dom.bodyTurn.value) });
  });
  dom.headTurnAssist.addEventListener("input", () => {
    setPoseBias({ headTurnAssist: Number(dom.headTurnAssist.value) });
  });

  dom.backgroundButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setStageBackground(button.dataset.backgroundColor);
    });
  });
  dom.backgroundCustom.addEventListener("input", () => {
    setStageBackground(dom.backgroundCustom.value);
  });

  dom.audioPick.addEventListener("click", () => dom.audioFile.click());
  dom.audioFile.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadAudioFile(file);
  });
  dom.audioPlay.addEventListener("click", () => enableAudioMode());
  dom.audioStop.addEventListener("click", () => disableAudioMode());
  dom.audioClear.addEventListener("click", () => {
    if (state.audio.enabled) disableAudioMode();
    clearLoadedAudio();
  });
  dom.audioAnalyze.addEventListener("click", runAnalysis);
  if (dom.audioExportMp4) {
    dom.audioExportMp4.addEventListener("click", () => {
      if (state.recording.instance) {
        state.recording.instance.requestStop();
      } else {
        startMp4Export();
      }
    });
  }
  dom.emotionMode.addEventListener("change", () => {
    state.analysis.enabled = dom.emotionMode.checked && state.analysis.events.length > 0;
  });
  window.addEventListener("beforeunload", () => {
    if (state.audio.enabled) disableAudioMode();
    if (state.audio.context && typeof state.audio.context.close === "function") {
      try {
        state.audio.context.close();
      } catch {}
    }
  });

  window.addEventListener("keydown", (event) => {
    const list = state.modelSpec?.expressions || [];
    const expression = list.find((item) => item.key === event.key);
    if (!expression) return;
    event.preventDefault();
    toggleExpression(expression.id);
  });
}

function updateRangeOutputs() {
  if (dom.bodyTurnValue) {
    dom.bodyTurnValue.textContent = Number(dom.bodyTurn.value).toFixed(1);
  }
  if (dom.headTurnAssistValue) {
    dom.headTurnAssistValue.textContent = Number(dom.headTurnAssist.value).toFixed(1);
  }
}

function ensureAudioContext() {
  if (state.audio.context) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) {
    throw new Error("このブラウザは Web Audio API に対応していません。");
  }
  const ctx = new Ctor();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.6;
  state.audio.context = ctx;
  state.audio.analyser = analyser;
  state.audio.freqData = new Uint8Array(analyser.frequencyBinCount);
  state.audio.timeData = new Uint8Array(analyser.fftSize);
}

async function loadAudioFile(file) {
  clearError();
  try {
    ensureAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await state.audio.context.decodeAudioData(arrayBuffer);
    state.audio.decodedBuffer = buffer;
    state.audio.fileName = file.name;
    dom.audioMeta.textContent = `${file.name} (${formatDuration(buffer.duration)})`;
    dom.audioPlay.disabled = false;
    resetAnalysisState();
    updateExportButtonState();
  } catch (error) {
    state.audio.decodedBuffer = null;
    dom.audioPlay.disabled = true;
    dom.audioMeta.textContent = "読込失敗";
    showError(`音声ファイルを読み込めませんでした: ${error?.message || error}`);
    resetAnalysisState();
    updateExportButtonState();
  }
}

async function enableAudioMode(options = {}) {
  if (state.audio.enabled) return;
  if (!state.modelReady) {
    showError("モデルの読み込み完了後に再生してください。");
    return;
  }

  clearError();

  try {
    ensureAudioContext();
    if (state.audio.context.state === "suspended") {
      await state.audio.context.resume();
    }

    if (!state.audio.decodedBuffer) {
      showError("先に音声ファイルを読み込んでください。");
      return;
    }
    startBufferPlayback();

    state.audio.enabled = true;
    state.audio.onEndedCallback = typeof options.onEnded === "function" ? options.onEnded : null;
    setChip(dom.audioStatus, "active", "Playing");
    dom.audioPlay.disabled = true;
    dom.audioStop.disabled = false;
    dom.audioPick.disabled = true;
    dom.audioAnalyze.disabled = true;
    if (dom.audioExportMp4) dom.audioExportMp4.disabled = true;
    scheduleAudioFrame();
  } catch (error) {
    disableAudioMode();
    showError(formatError(error));
  }
}

function disableAudioMode() {
  const endedCallback = state.audio.onEndedCallback;
  state.audio.onEndedCallback = null;

  if (state.audio.rafId) {
    cancelAnimationFrame(state.audio.rafId);
    state.audio.rafId = 0;
  }

  if (state.audio.bufferSource) {
    try {
      state.audio.bufferSource.onended = null;
      state.audio.bufferSource.stop();
    } catch {}
    try {
      state.audio.bufferSource.disconnect();
    } catch {}
    state.audio.bufferSource = null;
  }

  if (state.audio.analyser) {
    try {
      state.audio.analyser.disconnect();
    } catch {}
  }

  state.audio.enabled = false;
  state.audioParams.ParamMouthOpenY = 0;
  state.audioParams.ParamMouthForm = 0;
  state.audioParams.ParamAngleX = 0;
  state.audioParams.ParamAngleY = 0;
  state.audioParams.ParamAngleZ = 0;
  state.audioParams.ParamBodyAngleX = 0;
  state.audioParams.ParamBodyAngleY = 0;
  state.audioParams.ParamBodyAngleZ = 0;
  state.audioParams.ParamEyeBallX = 0;
  state.audioParams.ParamEyeBallY = 0;
  state.audio.blinkPhase = 0;
  state.audio.blinkFactor = 1;
  state.audio.blinkTimer = 0;
  state.audio.mouthEnvelope = 0;
  state.audio.activityLevel = 0;
  state.audio.idleGazeX = 0;
  state.audio.idleGazeY = 0;
  state.audio.idleGazeFrames = 9999;
  state.audio.idleGazeNextAt = 0;
  state.activeGesture = null;
  state.analysis.cursor = 0;

  setChip(dom.audioStatus, "idle", "Idle");

  dom.audioStop.disabled = true;
  dom.audioPick.disabled = false;
  dom.audioPlay.disabled = !state.audio.decodedBuffer;
  dom.audioAnalyze.disabled = !state.audio.decodedBuffer || state.analysis.busy;
  updateExportButtonState();

  if (typeof endedCallback === "function") {
    try {
      endedCallback();
    } catch (err) {
      console.error("[onEnded]", err);
    }
  }
}

function updateExportButtonState() {
  if (!dom.audioExportMp4) return;
  if (state.recording.instance) return;
  dom.audioExportMp4.disabled =
    !state.audio.decodedBuffer || state.audio.enabled || state.analysis.busy;
  dom.audioExportMp4.textContent = "MP4保存";
}

function startBufferPlayback() {
  const ctx = state.audio.context;
  const source = ctx.createBufferSource();
  source.buffer = state.audio.decodedBuffer;
  source.connect(state.audio.analyser);
  state.audio.analyser.connect(ctx.destination);
  source.onended = () => {
    if (state.audio.enabled) disableAudioMode();
  };
  source.start();
  state.audio.bufferSource = source;
  state.audio.startedAt = ctx.currentTime;
  state.analysis.cursor = 0;
  state.activeGesture = null;
}

function scheduleAudioFrame() {
  const tick = () => {
    if (!state.audio.enabled || !state.audio.analyser) return;
    const analyser = state.audio.analyser;
    analyser.getByteTimeDomainData(state.audio.timeData);
    analyser.getByteFrequencyData(state.audio.freqData);

    const time = state.audio.timeData;
    let sumSq = 0;
    for (let i = 0; i < time.length; i += 1) {
      const v = (time[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / time.length);
    const gain = MOUTH_GAIN;
    // Map RMS → mouth aperture. Floor cuts breath/consonants so the mouth fully
    // closes between syllables; lower peak reaches ~70% open at moderate voice.
    const FLOOR_RMS = 0.032;
    const SPEECH_PEAK_RMS = 0.16;
    const norm = clamp((rms - FLOOR_RMS) / (SPEECH_PEAK_RMS - FLOOR_RMS), 0, 1);
    const curved = Math.pow(norm, 1.3);
    const target = clamp(curved * gain * 1.6, 0, 1.7);
    // Audio-side envelope follower with fast release (mouth closes quickly on
    // consonant gaps for clearer ぱくぱく). The global smoother in
    // updateModelParameters is bypassed for this param in audio mode so this
    // envelope drives the model directly.
    const prev = state.audio.mouthEnvelope ?? 0;
    const alpha = target > prev ? 0.6 : 0.55;
    const mouthOpen = prev + (target - prev) * alpha;
    state.audio.mouthEnvelope = mouthOpen;
    state.audioParams.ParamMouthOpenY = mouthOpen;

    const bins = state.audio.freqData;
    const lowEnd = Math.max(2, Math.floor(bins.length * 0.08));
    const highEnd = Math.max(lowEnd + 2, Math.floor(bins.length * 0.45));
    let low = 0;
    let high = 0;
    for (let i = 0; i < lowEnd; i += 1) low += bins[i];
    for (let i = lowEnd; i < highEnd; i += 1) high += bins[i];
    const total = low + high + 1;
    const ratio = (high - low) / total;
    state.audioParams.ParamMouthForm = clamp(ratio * 0.6, -1, 1);

    const swayGain = HEAD_SWAY_GAIN;
    state.headSway.phase += 0.012;
    state.headSway.level = state.headSway.level * 0.92 + rms * 0.08;
    const env = (0.35 + 4 * state.headSway.level) * swayGain;
    const yaw = Math.sin(state.headSway.phase * 0.7) * 8 * env;
    const pitch = Math.sin(state.headSway.phase * 0.5 + 1.3) * 5 * env;
    const roll = Math.sin(state.headSway.phase * 0.3 + 2.1) * 4 * env;
    state.audioParams.ParamAngleX = yaw;
    state.audioParams.ParamAngleY = pitch;
    state.audioParams.ParamAngleZ = roll;
    state.audioParams.ParamBodyAngleX = yaw * 0.4;
    state.audioParams.ParamBodyAngleY = pitch * 0.4;
    state.audioParams.ParamBodyAngleZ = roll * 0.4;

    // Activity level: fast attack on voicing, slow release into silence.
    // Used to crossfade between speech-synced gaze and idle drift gaze.
    const speechActive = rms > 0.05 ? 1 : 0;
    const actAlpha = speechActive > state.audio.activityLevel ? 0.16 : 0.012;
    state.audio.activityLevel += (speechActive - state.audio.activityLevel) * actAlpha;

    // Idle gaze: pick a fresh random target every 2-6 seconds, drift slowly to it.
    state.audio.idleGazeFrames += 1;
    if (state.audio.idleGazeFrames >= state.audio.idleGazeNextAt) {
      state.audio.idleGazeFrames = 0;
      state.audio.idleGazeNextAt = 150 + Math.floor(Math.random() * 240);
      state.audio.idleGazeTargetX = (Math.random() - 0.5) * 0.7;
      state.audio.idleGazeTargetY = (Math.random() - 0.5) * 0.45 - 0.05;
    }
    state.audio.idleGazeX += (state.audio.idleGazeTargetX - state.audio.idleGazeX) * 0.022;
    state.audio.idleGazeY += (state.audio.idleGazeTargetY - state.audio.idleGazeY) * 0.022;

    const gazeIntensity = GAZE_INTENSITY;
    const speechEnv = clamp(state.headSway.level * 7, 0.18, 1);
    const activeGazeX = Math.sin(state.headSway.phase * 0.43 + 0.7) * 0.55 * speechEnv;
    const activeGazeY = Math.sin(state.headSway.phase * 0.27 + 1.9) * 0.4 * speechEnv;
    const blendActive = state.audio.activityLevel;
    const blendIdle = 1 - blendActive;
    state.audioParams.ParamEyeBallX =
      (activeGazeX * blendActive + state.audio.idleGazeX * blendIdle) * gazeIntensity;
    state.audioParams.ParamEyeBallY =
      (activeGazeY * blendActive + state.audio.idleGazeY * blendIdle) * gazeIntensity;

    state.audio.blinkTimer += 1;
    if (state.audio.blinkTimer >= state.audio.nextBlinkAt) {
      state.audio.blinkPhase = 1.0;
      state.audio.blinkTimer = 0;
      state.audio.nextBlinkAt = 180 + Math.floor(Math.random() * 240);
    }
    state.audio.blinkPhase = Math.max(0, state.audio.blinkPhase - 0.18);
    state.audio.blinkFactor = 1 - state.audio.blinkPhase;

    if (state.analysis.enabled && state.analysis.events.length) {
      const elapsed = state.audio.context.currentTime - state.audio.startedAt;
      while (
        state.analysis.cursor < state.analysis.events.length &&
        state.analysis.events[state.analysis.cursor].time <= elapsed
      ) {
        const ev = state.analysis.events[state.analysis.cursor++];
        if (ev.expression !== undefined) setExpression(ev.expression);
        if (ev.gesture) startGesture(ev.gesture, ev.intensity ?? 0.8);
      }
    }

    if (state.activeGesture) {
      const def = GESTURES[state.activeGesture.id];
      if (!def) {
        state.activeGesture = null;
      } else {
        const t =
          (state.audio.context.currentTime - state.activeGesture.startedAt) / def.durationSec;
        if (t >= 1) {
          state.activeGesture = null;
        } else {
          const offsets = def.apply(t, state.activeGesture.intensity);
          for (const [param, value] of Object.entries(offsets)) {
            state.audioParams[param] = (state.audioParams[param] ?? 0) + value;
          }
        }
      }
    }

    state.audio.rafId = requestAnimationFrame(tick);
  };
  state.audio.rafId = requestAnimationFrame(tick);
}

function startGesture(id, intensity) {
  if (!GESTURES[id]) return;
  state.activeGesture = {
    id,
    startedAt: state.audio.context.currentTime,
    intensity: Math.min(1, Math.max(0, Number(intensity) || 0.8)),
  };
}

function clearLoadedAudio() {
  state.audio.decodedBuffer = null;
  state.audio.fileName = "";
  dom.audioMeta.textContent = "未読込";
  dom.audioFile.value = "";
  dom.audioPlay.disabled = true;
  resetAnalysisState();
  updateExportButtonState();
}

function resetAnalysisState() {
  state.analysis.busy = false;
  state.analysis.segments = [];
  state.analysis.events = [];
  state.analysis.cursor = 0;
  state.analysis.enabled = false;
  state.activeGesture = null;
  dom.audioAnalyze.disabled = !state.audio.decodedBuffer;
  dom.emotionMode.disabled = true;
  dom.emotionMode.checked = false;
  dom.analysisMeta.hidden = true;
  dom.analysisMeta.textContent = "";
  dom.transcriptPanel.hidden = true;
  dom.transcriptList.replaceChildren();
}

async function runAnalysis() {
  if (state.analysis.busy) return;
  if (!state.audio.decodedBuffer) {
    showError("先に音声ファイルを読み込んでください。");
    return;
  }
  clearError();
  state.analysis.busy = true;
  dom.audioAnalyze.disabled = true;
  dom.audioPlay.disabled = true;
  dom.audioPick.disabled = true;
  dom.analysisMeta.hidden = false;
  dom.analysisMeta.textContent = "Whisper モデルを準備中…";
  setChip(dom.audioStatus, "loading", "Transcribing");

  try {
    const { transcribeAudio } = await import("./transcribe.js");
    const segments = await transcribeAudio(state.audio.decodedBuffer, {
      onProgress: (info) => {
        if (info?.status === "progress" && typeof info.progress === "number") {
          dom.analysisMeta.textContent = `モデル DL ${Math.round(info.progress * 100)}%`;
        } else if (info?.status === "ready") {
          dom.analysisMeta.textContent = "モデル準備完了";
        } else if (info?.status === "transcribe") {
          dom.analysisMeta.textContent = "文字起こし中…";
        } else if (info?.status === "convert") {
          dom.analysisMeta.textContent = "音声を解析用に変換中…";
        } else if (info?.status === "download" && info?.file) {
          dom.analysisMeta.textContent = `モデル取得中: ${info.file}`;
        }
      },
    });
    state.analysis.segments = segments;
    if (segments.length === 0) {
      throw new Error("文字起こしの結果が空です。音声に発話が含まれているか確認してください。");
    }

    setChip(dom.audioStatus, "loading", "Analyzing");
    dom.analysisMeta.textContent = "感情解析中（Claude）…";
    const expressions = (state.modelSpec?.expressions || []).map((e) => ({
      id: e.id,
      label: e.label,
    }));
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments, language: "ja", expressions }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`/api/analyze ${res.status}: ${errBody.error || "failed"}`);
    }
    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    state.analysis.events = events;
    state.analysis.cursor = 0;
    state.analysis.enabled = events.length > 0;

    dom.emotionMode.disabled = events.length === 0;
    dom.emotionMode.checked = events.length > 0;
    dom.analysisMeta.textContent = `解析完了：${segments.length} セグメント / ${events.length} イベント`;
    setChip(dom.audioStatus, "ready", "Ready");
    renderTranscript();
  } catch (error) {
    console.error("[runAnalysis]", error);
    showError(`解析失敗: ${error?.message || error}`);
    dom.analysisMeta.textContent = "解析失敗";
    setChip(dom.audioStatus, "error", "Error");
  } finally {
    state.analysis.busy = false;
    dom.audioAnalyze.disabled = !state.audio.decodedBuffer;
    dom.audioPlay.disabled = !state.audio.decodedBuffer;
    dom.audioPick.disabled = false;
    updateExportButtonState();
  }
}

async function startMp4Export() {
  if (state.recording.instance) return;
  if (state.audio.enabled || state.analysis.busy) {
    showError("再生中／解析中は録画できません。停止してから再度お試しください。");
    return;
  }
  if (!state.audio.decodedBuffer) {
    showError("先に音声ファイルを読み込んでください。");
    return;
  }
  if (!state.modelReady || !state.app) {
    showError("モデルの読み込み完了後に録画してください。");
    return;
  }

  clearError();

  let recorder;
  try {
    const { createMp4Recorder } = await import("./recorder.js");

    const updateTimer = () => {
      if (!state.recording.instance || !dom.recordingTimer) return;
      const seconds = Math.max(0, (performance.now() - state.recording.startedAt) / 1000);
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      dom.recordingTimer.textContent = `${m}:${String(s).padStart(2, "0")}`;
    };

    const stopTimer = () => {
      if (state.recording.timerId) {
        clearInterval(state.recording.timerId);
        state.recording.timerId = 0;
      }
    };

    const finalizeUi = () => {
      stopTimer();
      state.recording.instance = null;
      state.recording.startedAt = 0;
      if (dom.recordingIndicator) dom.recordingIndicator.hidden = true;
      if (dom.recordingTimer) dom.recordingTimer.textContent = "0:00";
      if (dom.audioExportMp4) {
        dom.audioExportMp4.textContent = "MP4保存";
        dom.audioExportMp4.disabled = false;
      }
      updateExportButtonState();
    };

    recorder = createMp4Recorder({
      pixiApp: state.app,
      stageEl: dom.stage,
      canvasEl: dom.canvas,
      decodedBuffer: state.audio.decodedBuffer,
      getElapsed: () => {
        const ctx = state.audio.context;
        if (!ctx) return 0;
        return ctx.currentTime - state.audio.startedAt;
      },
      refitModel: fitModelToStage,
      suggestedFilename: state.audio.fileName,
      onProgress: () => {},
      onComplete: () => {
        finalizeUi();
      },
      onCancelled: () => {
        finalizeUi();
      },
      onError: (err) => {
        console.error("[recorder]", err);
        showError(`録画失敗: ${err?.message || err}`);
        if (state.audio.enabled) disableAudioMode();
        finalizeUi();
      },
    });

    state.recording.instance = recorder;
    if (dom.audioExportMp4) {
      dom.audioExportMp4.textContent = "録画停止";
      dom.audioExportMp4.disabled = false;
    }
    if (dom.recordingIndicator) dom.recordingIndicator.hidden = false;

    await recorder.start();

    await enableAudioMode({
      onEnded: () => {
        if (state.recording.instance === recorder) {
          recorder.requestStop();
        }
      },
    });

    if (!state.audio.enabled) {
      // 再生開始に失敗した場合
      recorder.cancel();
      return;
    }

    recorder.attachTickerHook();
    state.recording.startedAt = performance.now();
    state.recording.timerId = setInterval(updateTimer, 250);
    setChip(dom.audioStatus, "active", "Recording");
  } catch (err) {
    console.error("[startMp4Export]", err);
    showError(`録画開始失敗: ${err?.message || err}`);
    if (recorder) {
      try {
        recorder.cancel();
      } catch {}
    }
    if (state.recording.timerId) {
      clearInterval(state.recording.timerId);
      state.recording.timerId = 0;
    }
    state.recording.instance = null;
    if (dom.recordingIndicator) dom.recordingIndicator.hidden = true;
    if (dom.audioExportMp4) {
      dom.audioExportMp4.textContent = "MP4保存";
    }
    updateExportButtonState();
  }
}

function renderTranscript() {
  dom.transcriptList.replaceChildren();
  if (!state.analysis.segments.length) {
    dom.transcriptPanel.hidden = true;
    return;
  }
  const eventsBySegment = state.analysis.segments.map((seg) =>
    state.analysis.events.filter((ev) => ev.time >= seg.start && ev.time < seg.end + 0.001),
  );
  for (let i = 0; i < state.analysis.segments.length; i += 1) {
    const seg = state.analysis.segments[i];
    const li = document.createElement("li");
    const time = document.createElement("span");
    time.className = "transcript-time";
    time.textContent = formatDuration(seg.start);
    li.append(time, document.createTextNode(seg.text));
    for (const ev of eventsBySegment[i]) {
      if (ev.expression !== undefined && ev.expression !== null) {
        li.append(buildChip("expr", ev.expression));
      } else if (ev.expression === null) {
        li.append(buildChip("expr", "neutral"));
      }
      if (ev.gesture) {
        li.append(buildChip("gesture", ev.gesture));
      }
    }
    dom.transcriptList.append(li);
  }
  dom.transcriptPanel.hidden = false;
}

function buildChip(kind, label) {
  const chip = document.createElement("span");
  chip.className = "transcript-chip";
  chip.dataset.kind = kind;
  chip.textContent = label;
  return chip;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function updateModelParameters() {
  if (!state.modelReady || !state.parameterSetter) return;

  const baseDefaults = state.curatedDefaults || DEFAULT_PARAMS;
  const base = state.audio.enabled
    ? { ...baseDefaults, ...state.audioParams }
    : { ...baseDefaults };
  // Expression-touched params not in baseDefaults must still be reset to model
  // default each frame, otherwise toggling/switching an expression leaves the
  // previous expression's offsets stuck on the model.
  for (const id of state.expressionParamIds) {
    if (!(id in base)) {
      base[id] = state.modelDefaults?.[id] ?? 0;
    }
  }
  updateExpressionPosture();
  const withExpression = applyPoseBias(applyExpressionBodyPosture(applyExpressionToParams(base)));
  // ParamMouthOpenY drives lip sync — expressions could otherwise lock the
  // mouth open or shut. ParamMouthForm is left to expressions (smile/angry/sad)
  // since the audio-driven value is small and the additive blend produces a
  // natural smile/frown shape on top of subtle lip-sync micro-movement.
  if (state.audio.enabled) {
    withExpression.ParamMouthOpenY = state.audioParams.ParamMouthOpenY;
  }
  for (const [id, target] of Object.entries(withExpression)) {
    const [min, max] = PARAM_RANGES[id] || [-Infinity, Infinity];
    let next = clamp(target, min, max);
    if (state.audio.enabled && (id === "ParamEyeLOpen" || id === "ParamEyeROpen")) {
      // Apply blink as a multiplier so expressions that widen the eyes
      // (e.g. surprise) still allow full closure during blinks.
      next = clamp(next * state.audio.blinkFactor, min, max);
    }
    // The mouth in audio mode already has its own envelope follower and would
    // otherwise be visibly delayed/saturated by the global smoother — pass it
    // through as-is so the ぱくぱく opens/closes between syllables stay crisp.
    const idAlpha = state.audio.enabled && id === "ParamMouthOpenY" ? 1 : SMOOTHING_ALPHA;
    state.smoothed[id] = lerp(state.smoothed[id] ?? next, next, idAlpha);
    state.parameterSetter(id, state.smoothed[id]);
  }
}

function applyPoseBias(params) {
  const output = { ...params };
  output.ParamBodyAngleX = (output.ParamBodyAngleX ?? 0) + state.poseBias.bodyTurn;
  output.ParamAngleX = (output.ParamAngleX ?? 0) + state.poseBias.headTurnAssist;
  return output;
}

function updateExpressionPosture() {
  const target = (state.activeExpression && EXPRESSION_BODY_POSTURE[state.activeExpression]) || {};
  const current = state.expressionPosture;
  const keys = new Set([...Object.keys(current), ...Object.keys(target)]);
  for (const key of keys) {
    const next = lerp(current[key] ?? 0, target[key] ?? 0, EXPRESSION_POSTURE_SMOOTHING);
    if (Math.abs(next) < 0.001 && !(key in target)) {
      delete current[key];
    } else {
      current[key] = next;
    }
  }
}

function applyExpressionBodyPosture(params) {
  const posture = state.expressionPosture;
  if (!posture || Object.keys(posture).length === 0) return params;
  const output = { ...params };
  for (const [key, value] of Object.entries(posture)) {
    output[key] = (output[key] ?? 0) + value;
  }
  return output;
}

function applyExpressionToParams(params) {
  const output = { ...params };
  const expression = state.activeExpression ? state.expressions.get(state.activeExpression) : null;
  if (!expression?.Parameters) return output;

  for (const parameter of expression.Parameters) {
    const id = parameter.Id;
    const value = Number(parameter.Value) || 0;
    const blend = String(parameter.Blend || "Add").toLowerCase();
    const current =
      output[id] ?? state.modelDefaults?.[id] ?? DEFAULT_PARAMS[id] ?? 0;

    if (blend === "multiply") {
      output[id] = current * value;
    } else if (blend === "overwrite" || blend === "set") {
      output[id] = value;
    } else {
      output[id] = current + value;
    }
  }

  return output;
}

function createParameterSetter(model) {
  const core = model.internalModel?.coreModel;
  if (!core) return null;

  const idManager = getCubismIdManager();
  const idCache = new Map();

  return (id, value) => {
    const numericValue = Number.isFinite(value) ? value : 0;

    try {
      if (typeof core.setParameterValueById === "function") {
        const handle = idManager ? getCachedId(idManager, idCache, id) : id;
        core.setParameterValueById(handle, numericValue, 1);
        return;
      }
    } catch (error) {
      if (!state.parameterWarningShown) {
        state.parameterWarningShown = true;
        console.warn("setParameterValueById failed; falling back to index setter.", error);
      }
    }

    const index = findParameterIndex(core, id);
    if (index >= 0 && typeof core.setParameterValue === "function") {
      core.setParameterValue(index, numericValue, 1);
    }
  };
}

function snapshotModelDefaults(model) {
  const out = {};
  const core = model?.internalModel?.coreModel;
  if (!core) return out;

  const params = core.parameters;
  if (params?.ids && params?.defaultValues) {
    for (let i = 0; i < params.ids.length; i += 1) {
      const id = params.ids[i];
      const text = typeof id === "string" ? id : id?._id || id?.id || String(id);
      out[text] = Number(params.defaultValues[i]) || 0;
    }
    return out;
  }

  const ids = core._parameterIds || core.parameterIds;
  if (ids && typeof core.getParameterDefaultValue === "function") {
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      const text = typeof id === "string" ? id : id?._id || id?.id || String(id);
      try {
        out[text] = Number(core.getParameterDefaultValue(i)) || 0;
      } catch {}
    }
  }
  return out;
}

function buildCuratedDefaults(modelDefaults) {
  const curated = {};
  for (const key of Object.keys(DEFAULT_PARAMS)) {
    curated[key] = modelDefaults[key] !== undefined ? modelDefaults[key] : DEFAULT_PARAMS[key];
  }
  return curated;
}

function getCubismIdManager() {
  const candidates = [
    window.PIXI?.live2d?.CubismFramework,
    window.PIXI?.live2d?.cubism4?.CubismFramework,
    window.Live2DCubismFramework?.CubismFramework,
  ];

  for (const candidate of candidates) {
    if (candidate?.getIdManager) {
      return candidate.getIdManager();
    }
  }
  return null;
}

function getCachedId(idManager, cache, id) {
  if (!cache.has(id)) {
    cache.set(id, idManager.getId(id));
  }
  return cache.get(id);
}

function findParameterIndex(core, id) {
  const ids = core._parameterIds || core.parameterIds || core.parameters?.ids;
  if (!ids) return -1;

  for (let index = 0; index < ids.length; index += 1) {
    const candidate = ids[index];
    const text = typeof candidate === "string" ? candidate : candidate?._id || candidate?.id || String(candidate);
    if (text === id) return index;
  }
  return -1;
}

function resetPose() {
  const reset = state.curatedDefaults || DEFAULT_PARAMS;
  state.smoothed = { ...reset };
  setExpression(null);
}

function readSavedPoseBias() {
  try {
    const parsed = JSON.parse(localStorage.getItem(POSE_BIAS_STORAGE_KEY) || "{}");
    return {
      bodyTurn: clampNumber(parsed.bodyTurn, ...POSE_BIAS_RANGES.bodyTurn, DEFAULT_POSE_BIAS.bodyTurn),
      headTurnAssist: clampNumber(
        parsed.headTurnAssist,
        ...POSE_BIAS_RANGES.headTurnAssist,
        DEFAULT_POSE_BIAS.headTurnAssist,
      ),
    };
  } catch {
    return { ...DEFAULT_POSE_BIAS };
  }
}

function setPoseBias(next, options = {}) {
  const persist = options.persist !== false;
  state.poseBias = {
    bodyTurn: clampNumber(
      next.bodyTurn ?? state.poseBias.bodyTurn,
      ...POSE_BIAS_RANGES.bodyTurn,
      DEFAULT_POSE_BIAS.bodyTurn,
    ),
    headTurnAssist: clampNumber(
      next.headTurnAssist ?? state.poseBias.headTurnAssist,
      ...POSE_BIAS_RANGES.headTurnAssist,
      DEFAULT_POSE_BIAS.headTurnAssist,
    ),
  };
  dom.bodyTurn.value = String(state.poseBias.bodyTurn);
  dom.headTurnAssist.value = String(state.poseBias.headTurnAssist);
  updateRangeOutputs();

  if (persist) {
    try {
      localStorage.setItem(POSE_BIAS_STORAGE_KEY, JSON.stringify(state.poseBias));
    } catch {}
  }
}

function clampNumber(value, min, max, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(number, min, max);
}

function readSavedBackgroundColor() {
  try {
    return normalizeHexColor(localStorage.getItem(BACKGROUND_STORAGE_KEY)) || DEFAULT_BACKGROUND_COLOR;
  } catch {
    return DEFAULT_BACKGROUND_COLOR;
  }
}

function setStageBackground(color, options = {}) {
  const normalized = normalizeHexColor(color) || DEFAULT_BACKGROUND_COLOR;
  const persist = options.persist !== false;
  state.backgroundColor = normalized;
  dom.stage.style.setProperty("--stage-background", normalized);
  dom.backgroundCustom.value = normalized;
  dom.backgroundButtons.forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(normalizeHexColor(button.dataset.backgroundColor) === normalized),
    );
  });
  applyRendererBackground(normalized);

  if (persist) {
    try {
      localStorage.setItem(BACKGROUND_STORAGE_KEY, normalized);
    } catch {}
  }
}

function applyRendererBackground(color) {
  const renderer = state.app?.renderer;
  if (!renderer) return;

  const numericColor = hexToNumber(color);
  if ("backgroundColor" in renderer) {
    renderer.backgroundColor = numericColor;
  }
  if ("backgroundAlpha" in renderer) {
    renderer.backgroundAlpha = 1;
  }
  if (renderer.background) {
    if ("color" in renderer.background) renderer.background.color = numericColor;
    if ("alpha" in renderer.background) renderer.background.alpha = 1;
  }
}

function normalizeHexColor(value) {
  const text = String(value || "").trim();
  const match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;

  const hex = match[1].toLowerCase();
  if (hex.length === 3) {
    return `#${hex.split("").map((char) => char + char).join("")}`;
  }
  return `#${hex}`;
}

function hexToNumber(color) {
  return Number.parseInt((normalizeHexColor(color) || DEFAULT_BACKGROUND_COLOR).slice(1), 16);
}

function toggleExpression(id) {
  setExpression(state.activeExpression === id ? null : id);
}

function setExpression(id) {
  state.activeExpression = id;
  document.querySelectorAll(".expression-button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.expression === id));
  });
}

function setChip(element, stateName, text) {
  element.dataset.state = stateName;
  element.querySelector("strong").textContent = text;
}

function showLoading(message) {
  dom.loadMessage.textContent = message;
  dom.overlay.dataset.hidden = "false";
}

function hideLoading() {
  dom.overlay.dataset.hidden = "true";
}

function showError(message) {
  dom.errorBox.hidden = false;
  dom.errorBox.textContent = message;
}

function clearError() {
  dom.errorBox.hidden = true;
  dom.errorBox.textContent = "";
}

function formatError(error) {
  return error?.message || String(error);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from, to, alpha) {
  return from + (to - from) * alpha;
}
