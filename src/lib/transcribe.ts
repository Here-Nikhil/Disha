import type { ApiProvider, VoiceProvider } from "./mock-store";

export type TranscribeProvider = VoiceProvider;

export function pickTranscribeProvider(
  apiKeys: Record<ApiProvider, { value: string; status: string }>,
  preferred: VoiceProvider | "auto",
): TranscribeProvider | null {
  const has = (p: VoiceProvider) => {
    const v = apiKeys[p]?.value?.trim();
    return !!v && v.length > 20 && !v.includes("****");
  };
  if (preferred !== "auto" && has(preferred)) return preferred;
  const order: VoiceProvider[] = ["Groq", "OpenAI", "Google"];
  return order.find(has) ?? null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function transcribeAudio(
  blob: Blob,
  provider: TranscribeProvider,
  apiKey: string,
): Promise<string> {
  if (provider === "Groq") {
    const form = new FormData();
    form.append("file", blob, "recording.webm");
    form.append("model", "whisper-large-v3-turbo");
    const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!resp.ok) throw new Error(`Groq: ${await resp.text()}`);
    const data = await resp.json();
    return (data.text || "").trim();
  }
  if (provider === "OpenAI") {
    const form = new FormData();
    form.append("file", blob, "recording.webm");
    form.append("model", "whisper-1");
    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!resp.ok) throw new Error(`OpenAI: ${await resp.text()}`);
    const data = await resp.json();
    return (data.text || "").trim();
  }
  if (provider === "Google") {
    const b64 = await blobToBase64(blob);
    const resp = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { encoding: "WEBM_OPUS", sampleRateHertz: 48000, languageCode: "en-US" },
          audio: { content: b64 },
        }),
      },
    );
    if (!resp.ok) throw new Error(`Google: ${await resp.text()}`);
    const data = await resp.json();
    return ((data.results || [])
      .map((r: any) => r.alternatives?.[0]?.transcript || "")
      .join(" ")).trim();
  }
  throw new Error(`Unsupported provider: ${provider}`);
}