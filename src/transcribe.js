const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
const MODEL_ID = "Xenova/whisper-base";
const TARGET_SAMPLE_RATE = 16000;

let pipelinePromise = null;

export async function transcribeAudio(audioBuffer, { onProgress, language = "japanese" } = {}) {
  const pipe = await ensurePipeline(onProgress);
  if (typeof onProgress === "function") {
    onProgress({ status: "convert", progress: 0 });
  }
  const monoFloat32 = await mixToMono(audioBuffer, TARGET_SAMPLE_RATE);
  if (typeof onProgress === "function") {
    onProgress({ status: "transcribe", progress: 0 });
  }
  const result = await pipe(monoFloat32, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    language,
    task: "transcribe",
  });
  const chunks = Array.isArray(result?.chunks) ? result.chunks : [];
  return chunks
    .map((chunk) => ({
      start: Number(chunk.timestamp?.[0]) || 0,
      end: Number(chunk.timestamp?.[1]) || 0,
      text: typeof chunk.text === "string" ? chunk.text.trim() : "",
    }))
    .filter((segment) => segment.text);
}

async function ensurePipeline(onProgress) {
  if (pipelinePromise) return pipelinePromise;
  pipelinePromise = (async () => {
    const { pipeline, env } = await import(TRANSFORMERS_URL);
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    return pipeline("automatic-speech-recognition", MODEL_ID, {
      progress_callback:
        typeof onProgress === "function"
          ? (info) => {
              const progress = typeof info?.progress === "number" ? info.progress / 100 : undefined;
              onProgress({ status: info?.status || "download", progress, file: info?.file });
            }
          : undefined,
    });
  })();
  try {
    return await pipelinePromise;
  } catch (error) {
    pipelinePromise = null;
    throw error;
  }
}

async function mixToMono(audioBuffer, sampleRate) {
  const length = Math.ceil(audioBuffer.duration * sampleRate);
  const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Ctor) throw new Error("OfflineAudioContext is not available in this browser.");
  const offline = new Ctor({ numberOfChannels: 1, length, sampleRate });
  const source = offline.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}
