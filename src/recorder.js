import { resolveLocalFirst } from "./app.js";

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const FRAME_DUR_US = Math.round(1_000_000 / FPS);
const VIDEO_BITRATE = 8_000_000;
const AUDIO_BITRATE = 192_000;
const KEYFRAME_INTERVAL = 60;
const VIDEO_CODEC = "avc1.640028";
const AUDIO_CODEC = "mp4a.40.2";
const AUDIO_FRAME_SIZE = 1024;

const MUXER_CDN = "https://cdn.jsdelivr.net/npm/mp4-muxer@5/+esm";
const MUXER_LOCAL = "./vendor/mp4-muxer.mjs";

let muxerModulePromise = null;

export async function loadMp4Muxer() {
  if (!muxerModulePromise) {
    muxerModulePromise = (async () => {
      const url = await resolveLocalFirst(MUXER_LOCAL, MUXER_CDN);
      const mod = await import(url);
      const Muxer = mod.Muxer || mod.default?.Muxer;
      const ArrayBufferTarget = mod.ArrayBufferTarget || mod.default?.ArrayBufferTarget;
      if (!Muxer || !ArrayBufferTarget) {
        throw new Error("mp4-muxer モジュールの読み込みに失敗しました。");
      }
      return { Muxer, ArrayBufferTarget };
    })().catch((err) => {
      muxerModulePromise = null;
      throw err;
    });
  }
  return muxerModulePromise;
}

export async function isWebCodecsSupported() {
  if (typeof window === "undefined") return false;
  if (typeof window.VideoEncoder !== "function") return false;
  if (typeof window.AudioEncoder !== "function") return false;
  if (typeof window.VideoFrame !== "function") return false;
  if (typeof window.AudioData !== "function") return false;
  try {
    const v = await window.VideoEncoder.isConfigSupported({
      codec: VIDEO_CODEC,
      width: WIDTH,
      height: HEIGHT,
      bitrate: VIDEO_BITRATE,
      framerate: FPS,
    });
    if (!v?.supported) return false;
    const a = await window.AudioEncoder.isConfigSupported({
      codec: AUDIO_CODEC,
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: AUDIO_BITRATE,
    });
    if (!a?.supported) return false;
    return true;
  } catch {
    return false;
  }
}

export function createMp4Recorder(deps) {
  const {
    pixiApp,
    stageEl,
    canvasEl,
    decodedBuffer,
    getElapsed,
    onProgress,
    onError,
    onComplete,
    onCancelled,
    refitModel,
    suggestedFilename,
  } = deps;

  let phase = "idle"; // idle | preparing | recording | finishing | cancelled | done | error
  let muxer = null;
  let videoEncoder = null;
  let audioEncoder = null;
  let audioEncodePromise = null;
  let frameIndex = 0;
  let expectedFrameCount = 0;
  let captureBound = null;
  let savedLayout = null;
  let firstFrameCaptured = false;

  function setPhase(next) {
    phase = next;
  }

  function applyRecordingLayout() {
    savedLayout = {
      resizeTo: pixiApp.resizeTo,
      rendererWidth: pixiApp.renderer.width,
      rendererHeight: pixiApp.renderer.height,
      rendererResolution: pixiApp.renderer.resolution,
      canvasStyleWidth: canvasEl.style.width,
      canvasStyleHeight: canvasEl.style.height,
      bodyDataset: document.body.dataset.recording,
    };
    document.body.dataset.recording = "1";
    // 可視レイアウトは触らず、Pixi の backing store のみ 1920x1080 化
    pixiApp.resizeTo = null;
    pixiApp.renderer.resolution = 1;
    pixiApp.renderer.resize(WIDTH, HEIGHT);
    // autoDensity が canvas の inline style を 1920x1080px に書き換えるので
    // 親 .stage に追従するよう空文字で解除（CSS の width:100%/height:100% が効く）
    canvasEl.style.width = "";
    canvasEl.style.height = "";
    refitModel?.();
  }

  function restoreLayout() {
    if (!savedLayout) return;
    if (savedLayout.bodyDataset == null) {
      delete document.body.dataset.recording;
    } else {
      document.body.dataset.recording = savedLayout.bodyDataset;
    }
    pixiApp.renderer.resolution = savedLayout.rendererResolution;
    pixiApp.resizeTo = savedLayout.resizeTo;
    if (savedLayout.resizeTo) {
      try {
        pixiApp.resize();
      } catch {
        pixiApp.renderer.resize(savedLayout.rendererWidth, savedLayout.rendererHeight);
      }
    } else {
      pixiApp.renderer.resize(savedLayout.rendererWidth, savedLayout.rendererHeight);
    }
    canvasEl.style.width = savedLayout.canvasStyleWidth;
    canvasEl.style.height = savedLayout.canvasStyleHeight;
    savedLayout = null;
    refitModel?.();
  }

  function downmixToStereo(buffer) {
    const ch = buffer.numberOfChannels;
    if (ch <= 2) return null;
    const len = buffer.length;
    const left = new Float32Array(len);
    const right = new Float32Array(len);
    for (let c = 0; c < ch; c += 1) {
      const data = buffer.getChannelData(c);
      const target = c % 2 === 0 ? left : right;
      for (let i = 0; i < len; i += 1) target[i] += data[i];
    }
    const halfL = Math.ceil(ch / 2);
    const halfR = Math.floor(ch / 2);
    if (halfL > 1) for (let i = 0; i < len; i += 1) left[i] /= halfL;
    if (halfR > 1) for (let i = 0; i < len; i += 1) right[i] /= halfR;
    return [left, right];
  }

  async function encodeAllAudio(channels, sampleRate, numberOfChannels) {
    const totalFrames = channels[0].length;
    let offset = 0;
    let chunkCounter = 0;
    while (offset < totalFrames) {
      if (phase === "cancelled" || phase === "error") return;
      const chunkLen = Math.min(AUDIO_FRAME_SIZE, totalFrames - offset);
      const buf = new Float32Array(numberOfChannels * chunkLen);
      for (let c = 0; c < numberOfChannels; c += 1) {
        buf.set(channels[c].subarray(offset, offset + chunkLen), c * chunkLen);
      }
      const audioData = new AudioData({
        format: "f32-planar",
        sampleRate,
        numberOfChannels,
        numberOfFrames: chunkLen,
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data: buf,
      });
      try {
        audioEncoder.encode(audioData);
      } finally {
        audioData.close();
      }
      offset += chunkLen;
      chunkCounter += 1;
      if (chunkCounter % 64 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  function captureTickFn() {
    if (phase !== "recording") return;
    const elapsed = getElapsed();
    if (elapsed < 0) return;
    let captured = 0;
    while (frameIndex < expectedFrameCount && elapsed >= frameIndex / FPS) {
      let frame;
      try {
        frame = new VideoFrame(canvasEl, {
          timestamp: frameIndex * FRAME_DUR_US,
          duration: FRAME_DUR_US,
        });
      } catch (err) {
        handleError(err);
        return;
      }
      try {
        videoEncoder.encode(frame, { keyFrame: frameIndex % KEYFRAME_INTERVAL === 0 });
      } catch (err) {
        frame.close();
        handleError(err);
        return;
      }
      frame.close();
      frameIndex += 1;
      captured += 1;
      firstFrameCaptured = true;
      if (captured >= 4) break; // 大きく遅れた場合の暴走防止
    }
    if (captured > 0 && onProgress) {
      onProgress({
        phase: "recording",
        elapsedSec: elapsed,
        frameCount: frameIndex,
        totalFrames: expectedFrameCount,
      });
    }
  }

  function handleError(err) {
    if (phase === "error" || phase === "cancelled" || phase === "done") return;
    setPhase("error");
    teardown();
    onError?.(err);
  }

  function teardown() {
    if (captureBound) {
      try {
        pixiApp.ticker.remove(captureBound);
      } catch {}
      captureBound = null;
    }
    if (videoEncoder && videoEncoder.state !== "closed") {
      try {
        videoEncoder.close();
      } catch {}
    }
    if (audioEncoder && audioEncoder.state !== "closed") {
      try {
        audioEncoder.close();
      } catch {}
    }
    videoEncoder = null;
    audioEncoder = null;
    muxer = null;
    restoreLayout();
  }

  function buildFilename() {
    const base = (suggestedFilename || "").trim();
    let stem;
    if (base) {
      stem = base.replace(/[\\/]+/g, "_").replace(/\.[^./\\]+$/, "");
    } else {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      stem = `live2d-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }
    return `${stem}.mp4`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function start() {
    if (phase !== "idle") {
      throw new Error("録画はすでに進行中です。");
    }
    if (!decodedBuffer) {
      throw new Error("先に音声ファイルを読み込んでください。");
    }
    setPhase("preparing");

    if (!(await isWebCodecsSupported())) {
      setPhase("idle");
      throw new Error("このブラウザは MP4 録画に必要な WebCodecs / コーデックに対応していません。");
    }

    const { Muxer, ArrayBufferTarget } = await loadMp4Muxer();

    const sampleRate = decodedBuffer.sampleRate;
    const srcChannels = decodedBuffer.numberOfChannels;
    const numberOfChannels = Math.min(srcChannels, 2);

    let channels;
    if (srcChannels > 2) {
      channels = downmixToStereo(decodedBuffer);
    } else {
      channels = [];
      for (let c = 0; c < srcChannels; c += 1) {
        channels.push(decodedBuffer.getChannelData(c));
      }
    }

    const target = new ArrayBufferTarget();
    muxer = new Muxer({
      target,
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
      video: { codec: "avc", width: WIDTH, height: HEIGHT },
      audio: { codec: "aac", sampleRate, numberOfChannels },
    });

    videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          muxer?.addVideoChunk(chunk, meta);
        } catch (err) {
          handleError(err);
        }
      },
      error: (err) => handleError(err),
    });
    videoEncoder.configure({
      codec: VIDEO_CODEC,
      width: WIDTH,
      height: HEIGHT,
      framerate: FPS,
      bitrate: VIDEO_BITRATE,
      hardwareAcceleration: "prefer-hardware",
      latencyMode: "realtime",
      avc: { format: "avc" },
    });

    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        try {
          muxer?.addAudioChunk(chunk, meta);
        } catch (err) {
          handleError(err);
        }
      },
      error: (err) => handleError(err),
    });
    audioEncoder.configure({
      codec: AUDIO_CODEC,
      sampleRate,
      numberOfChannels,
      bitrate: AUDIO_BITRATE,
    });

    expectedFrameCount = Math.max(1, Math.ceil(decodedBuffer.duration * FPS));
    frameIndex = 0;
    firstFrameCaptured = false;

    applyRecordingLayout();

    audioEncodePromise = encodeAllAudio(channels, sampleRate, numberOfChannels).catch((err) => {
      handleError(err);
    });
  }

  function attachTickerHook() {
    if (phase !== "preparing") return;
    setPhase("recording");
    captureBound = captureTickFn;
    const PIXI = window.PIXI;
    const priority = PIXI?.UPDATE_PRIORITY?.LOW ?? 0;
    pixiApp.ticker.add(captureBound, null, priority);
    onProgress?.({ phase: "recording", elapsedSec: 0, frameCount: 0, totalFrames: expectedFrameCount });
  }

  async function requestStop() {
    if (phase === "finishing" || phase === "done" || phase === "cancelled" || phase === "error") return;
    if (phase === "preparing" || phase === "recording") {
      setPhase("finishing");
    } else {
      return;
    }

    if (captureBound) {
      try {
        pixiApp.ticker.remove(captureBound);
      } catch {}
      captureBound = null;
    }

    try {
      // 残りフレームを expected まで埋める（早期終了でも軽くフィル）
      if (firstFrameCaptured && frameIndex < expectedFrameCount) {
        try {
          const tailLimit = Math.min(expectedFrameCount, frameIndex + 1);
          while (frameIndex < tailLimit) {
            const frame = new VideoFrame(canvasEl, {
              timestamp: frameIndex * FRAME_DUR_US,
              duration: FRAME_DUR_US,
            });
            videoEncoder.encode(frame, { keyFrame: frameIndex % KEYFRAME_INTERVAL === 0 });
            frame.close();
            frameIndex += 1;
          }
        } catch {}
      }

      if (audioEncodePromise) {
        await audioEncodePromise;
      }
      if (audioEncoder && audioEncoder.state !== "closed") {
        await audioEncoder.flush();
      }
      if (videoEncoder && videoEncoder.state !== "closed") {
        await videoEncoder.flush();
      }
      if (!muxer) {
        throw new Error("muxer が初期化されていません。");
      }
      if (!firstFrameCaptured) {
        throw new Error("動画フレームを 1 枚もキャプチャできませんでした。");
      }

      const targetRef = muxer.target;
      muxer.finalize();
      const buffer = targetRef.buffer;

      teardown();

      const blob = new Blob([buffer], { type: "video/mp4" });
      const filename = buildFilename();
      downloadBlob(blob, filename);

      setPhase("done");
      onComplete?.(blob, filename);
    } catch (err) {
      handleError(err);
    }
  }

  function cancel() {
    if (phase === "done" || phase === "cancelled" || phase === "error") return;
    setPhase("cancelled");
    teardown();
    onCancelled?.();
  }

  function isRecording() {
    return phase === "preparing" || phase === "recording" || phase === "finishing";
  }

  function framesEncoded() {
    return frameIndex;
  }

  return { start, attachTickerHook, requestStop, cancel, isRecording, framesEncoded };
}
