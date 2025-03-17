import CryptoJS from "crypto-js";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const VOICES_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;
const SYNTH_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const JSON_XML_DELIM = "\r\n\r\n";
const AUDIO_DELIM = "Path:audio\r\n";
const VOICE_LANG_REGEX = /\w{2}-\w{2}/;

// Message types
enum MessageTypes {
  TURN_START = "turn.start",
  TURN_END = "turn.end",
  RESPONSE = "response",
  SPEECH_CONFIG = "speech.config",
  AUDIO_METADATA = "audio.metadata",
  AUDIO = "audio",
  SSML = "ssml",
}

// Output formats
export enum OUTPUT_FORMAT {
  AUDIO_16KHZ_32KBITRATE_MONO_MP3 = "audio-16khz-32kbitrate-mono-mp3",
  AUDIO_16KHZ_64KBITRATE_MONO_MP3 = "audio-16khz-64kbitrate-mono-mp3",
  AUDIO_16KHZ_128KBITRATE_MONO_MP3 = "audio-16khz-128kbitrate-mono-mp3",
  AUDIO_24KHZ_48KBITRATE_MONO_MP3 = "audio-24khz-48kbitrate-mono-mp3",
  AUDIO_24KHZ_96KBITRATE_MONO_MP3 = "audio-24khz-96kbitrate-mono-mp3",
  AUDIO_24KHZ_160KBITRATE_MONO_MP3 = "audio-24khz-160kbitrate-mono-mp3",
  AUDIO_48KHZ_96KBITRATE_MONO_MP3 = "audio-48khz-96kbitrate-mono-mp3",
  AUDIO_48KHZ_192KBITRATE_MONO_MP3 = "audio-48khz-192kbitrate-mono-mp3",
  RAW_16KHZ_16BIT_MONO_PCM = "raw-16khz-16bit-mono-pcm",
  RAW_24KHZ_16BIT_MONO_PCM = "raw-24khz-16bit-mono-pcm",
  RAW_48KHZ_16BIT_MONO_PCM = "raw-48khz-16bit-mono-pcm",
  RAW_8KHZ_8BIT_MONO_MULAW = "raw-8khz-8bit-mono-mulaw",
  RAW_8KHZ_8BIT_MONO_ALAW = "raw-8khz-8bit-mono-alaw",
  WEBM_16KHZ_16BIT_MONO_OPUS = "webm-16khz-16bit-mono-opus",
  WEBM_24KHZ_16BIT_MONO_OPUS = "webm-24khz-16bit-mono-opus",
  OGG_16KHZ_16BIT_MONO_OPUS = "ogg-16khz-16bit-mono-opus",
  OGG_24KHZ_16BIT_MONO_OPUS = "ogg-24khz-16bit-mono-opus",
  OGG_48KHZ_16BIT_MONO_OPUS = "ogg-48khz-16bit-mono-opus",
}

// Output extensions
export const OUTPUT_EXTENSIONS = {
  [OUTPUT_FORMAT.AUDIO_16KHZ_32KBITRATE_MONO_MP3]: "mp3",
  [OUTPUT_FORMAT.AUDIO_16KHZ_64KBITRATE_MONO_MP3]: "mp3",
  [OUTPUT_FORMAT.AUDIO_16KHZ_128KBITRATE_MONO_MP3]: "mp3",
  [OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3]: "mp3",
  [OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3]: "mp3",
  [OUTPUT_FORMAT.AUDIO_24KHZ_160KBITRATE_MONO_MP3]: "mp3",
  [OUTPUT_FORMAT.AUDIO_48KHZ_96KBITRATE_MONO_MP3]: "mp3",
  [OUTPUT_FORMAT.AUDIO_48KHZ_192KBITRATE_MONO_MP3]: "mp3",
  [OUTPUT_FORMAT.RAW_16KHZ_16BIT_MONO_PCM]: "pcm",
  [OUTPUT_FORMAT.RAW_24KHZ_16BIT_MONO_PCM]: "pcm",
  [OUTPUT_FORMAT.RAW_48KHZ_16BIT_MONO_PCM]: "pcm",
  [OUTPUT_FORMAT.RAW_8KHZ_8BIT_MONO_MULAW]: "mulaw",
  [OUTPUT_FORMAT.RAW_8KHZ_8BIT_MONO_ALAW]: "alaw",
  [OUTPUT_FORMAT.WEBM_16KHZ_16BIT_MONO_OPUS]: "webm",
  [OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS]: "webm",
  [OUTPUT_FORMAT.OGG_16KHZ_16BIT_MONO_OPUS]: "ogg",
  [OUTPUT_FORMAT.OGG_24KHZ_16BIT_MONO_OPUS]: "ogg",
  [OUTPUT_FORMAT.OGG_48KHZ_16BIT_MONO_OPUS]: "ogg",
};

// Prosody options
export class ProsodyOptions {
  /**
   * (optional) Volume can range from 0 to 100 (default is 100). Example values:
   * - silent
   * - x-soft
   * - soft
   * - medium
   * - loud
   * - x-loud
   * - +0%
   * - -50%
   */
  volume?: string = "medium";
  /**
   * (optional) Pitch can range from -50% to +50% (default is +0%). Example values:
   * - x-low
   * - low
   * - medium
   * - high
   * - x-high
   * - +0%
   * - -5%
   * - +5%
   */
  pitch?: string = "+0%";
  /**
   * (optional) Rate can range from -50% to +100% (default is +0%). Example values:
   * - x-slow
   * - slow
   * - medium
   * - fast
   * - x-fast
   * - +0%
   * - -5%
   * - +5%
   */
  rate?: string = "+0%";
}

// Metadata options
export class MetadataOptions {
  /**
   * (optional) any voice locale that is supported by the voice
   */
  voiceLocale?: string;
  /**
   * (optional) whether to enable sentence boundary metadata
   */
  sentenceBoundaryEnabled?: boolean = false;
  /**
   * (optional) whether to enable word boundary metadata
   */
  wordBoundaryEnabled?: boolean = false;
}

// Voice type
export type Voice = {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  SuggestedCodec: string;
  FriendlyName: string;
  Status: string;
};

// Function to generate a random request ID
function generateRequestId(): string {
  return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
}

// Function to create SSML template
function createSSMLTemplate(
  input: string,
  voice: string,
  voiceLocale: string,
  options: ProsodyOptions = {}
): string {
  const defaultOptions = new ProsodyOptions();
  const mergedOptions = { ...defaultOptions, ...options };

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voiceLocale}">
    <voice name="${voice}">
      <prosody pitch="${mergedOptions.pitch}" rate="${mergedOptions.rate}" volume="${mergedOptions.volume}">
        ${input}
      </prosody>
    </voice>
  </speak>`;
}

// EdgeTTS main class
export class EdgeTTS {
  private voiceName: string;
  private outputFormat: OUTPUT_FORMAT;
  private metadataOptions: MetadataOptions;

  constructor(
    voiceName: string,
    outputFormat: OUTPUT_FORMAT,
    metadataOptions: MetadataOptions = new MetadataOptions()
  ) {
    this.voiceName = voiceName;
    this.outputFormat = outputFormat;

    // Set voice locale if not provided
    if (!metadataOptions.voiceLocale) {
      const voiceLangMatch = VOICE_LANG_REGEX.exec(voiceName);
      if (!voiceLangMatch) {
        throw new Error(
          "Could not infer voiceLocale from voiceName, and no voiceLocale was specified!"
        );
      }
      metadataOptions.voiceLocale = voiceLangMatch[0];
    }

    this.metadataOptions = metadataOptions;
  }

  // Create a WebSocket connection
  private async createWebSocketConnection(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(SYNTH_URL);

      ws.addEventListener("open", () => {
        // Send speech config
        const speechConfig = `Content-Type:application/json; charset=utf-8\r\nPath:${MessageTypes.SPEECH_CONFIG}${JSON_XML_DELIM}
        {
          "context": {
            "synthesis": {
              "audio": {
                "metadataoptions": {
                  "sentenceBoundaryEnabled": "${this.metadataOptions.sentenceBoundaryEnabled}",
                  "wordBoundaryEnabled": "${this.metadataOptions.wordBoundaryEnabled}"
                },
                "outputFormat": "${this.outputFormat}"
              }
            }
          }
        }`;

        ws.send(speechConfig);
        resolve(ws);
      });

      ws.addEventListener("error", (error) => {
        reject(new Error(`WebSocket connection error: ${error}`));
      });
    });
  }

  // Process text to speech
  async textToSpeechStream(
    text: string,
    options: ProsodyOptions = {}
  ): Promise<ReadableStream<Uint8Array>> {
    const ssml = createSSMLTemplate(
      text,
      this.voiceName,
      this.metadataOptions.voiceLocale as string,
      options
    );
    const requestId = generateRequestId();

    const ws = await this.createWebSocketConnection();

    return new ReadableStream({
      start(controller) {
        const ssmlRequest = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:${MessageTypes.SSML}${JSON_XML_DELIM}${ssml}`;
        ws.send(ssmlRequest);

        ws.addEventListener("message", (event) => {
          if (event.data instanceof ArrayBuffer) {
            const data = new Uint8Array(event.data);
            const message = new TextDecoder().decode(data);

            if (message.includes(`Path:${MessageTypes.AUDIO}`)) {
              const dataStartIndex =
                message.indexOf(AUDIO_DELIM) + AUDIO_DELIM.length;
              const audioData = data.slice(dataStartIndex);

              controller.enqueue(audioData);
            } else if (message.includes(`Path:${MessageTypes.TURN_END}`)) {
              controller.close();
              ws.close();
            }
          }
        });

        ws.addEventListener("close", () => {
          controller.close();
        });

        ws.addEventListener("error", (error) => {
          controller.error(error);
          ws.close();
        });
      },
      cancel() {
        ws.close();
      },
    });
  }

  async getVoices(): Promise<Voice[]> {
    const response = await fetch(VOICES_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }
    return await response.json();
  }
}