# Voice and video answers: browser support

Checkpoints can be answered by video, voice or text. Only the words are scored. Nothing about the face, voice tone, accent or fluency is measured. Text works in every browser.

## How voice transcription works

The demo has no API keys, so speech to text uses the browser's built-in `SpeechRecognition` (`lib/checkpoint/speech.ts`, `components/checkpoint/useRecorder.ts`).

- It keeps listening for the whole answer. Browsers stop recognition after a few seconds of silence or about a minute; we start it again until the candidate presses Done or time runs out.
- Words show live as captions while the candidate speaks (interim results in lighter text).
- A mic level meter shows during the think time and the answer, so the candidate can see the mic works. Loudness is only drawn on screen, never stored or scored.
- After the answer, the candidate sees "What we heard" in an editable box and can fix misheard words or type what they said. That text is what is saved and scored. Paste is off in that box, same as text answers.
- The recording is kept either way (unless the candidate deletes or hides it later).
- **On-device fallback.** If live captions got no words (no speech service in this browser, blocked, offline, Firefox), the recording is turned into text on the device when the candidate presses Done: a small Whisper model (`onnx-community/whisper-tiny.en`, transformers.js, WebAssembly) runs in the browser. The audio never leaves the device and no key is needed. The model files (about 40 MB) download from huggingface.co the first time and are cached by the browser after that, and they start downloading as soon as live captions are known not to work. A 10 to 15 second answer takes about 5 to 10 seconds on a laptop; the box says "Turning your recording into text on this device" meanwhile, and the candidate can type. If the model can't load (offline on first use), they type the words. Video answers keep an audio-only copy in memory for this; it is never saved.
- "Listening" only shows once the browser confirms it started. If it never confirms within 4 seconds, the candidate sees "Live captions aren't working in this browser. Keep talking: your recording is saved, and we'll turn it into text on this device when you finish."
- If they change any words, the card keeps the original speech-to-text text (`recognizedText`) and adds an integrity note: "Transcript corrected before submit: N words changed (context, not scored)". Recruiters can open the original under the clip. Evidence quotes still have to match the submitted transcript exactly. Transcripts can't be edited after submit (C7.2).

## By browser

| Browser | Recording | Live speech to text | What the candidate sees |
| --- | --- | --- | --- |
| Chrome (desktop, Android) | Yes | Yes. Audio goes to Google's speech service, so it needs internet. | Live captions, mic meter, editable transcript. If the connection drops: "Live captions need an internet connection in this browser and it dropped..." and the recording is transcribed on the device at Done. |
| Edge (desktop) | Yes | Usually (Microsoft's service, needs internet); some builds have no service | Live captions, or the on-device fallback. |
| Safari (macOS 14.1+, iOS 17+) | Yes | Partly. Works, but can stop early or miss words, and iOS may hand the mic to one or the other. | Captions when it works. Restarts happen by themselves. If no words came through at all, the on-device fallback runs. |
| Firefox | Yes | No | Before answering: "This browser can't show live captions. We'll still record your answer and turn it into text on this device when you finish." At Done the on-device model fills the box. |
| Chromium, Brave, some Edge/Arc builds | Yes | The API exists but there is no speech service behind it: it never starts (no error) | Before the fix this showed "Listening" with nothing heard and an empty transcript (the reported bug). Now: "Live captions aren't working in this browser..." within 4 s, then the on-device model fills the box at Done. |
| Any browser, camera or mic blocked | Camera blocked: voice or text. Mic blocked too: text. | n/a | One calm line, for example "The browser didn't allow the camera. Answer by voice or text instead; it counts exactly the same. The timer waits for you." plus one-tap "Answer by voice" and "Answer in text" buttons. The think timer does not run until they tap (or pick a mode). Never an error tone. |

## Errors in plain words

| Recognition error | What happens |
| --- | --- |
| `no-speech`, `aborted` | Silent restart. Nothing shown. |
| `network` | Up to 3 silent retries, then a message. |
| `not-allowed`, `service-not-allowed` | Message, recording continues, transcribed on the device at Done. |
| `audio-capture` | "Live captions can't reach the microphone..." then the on-device fallback. |
| Never starts (no service) | "Live captions aren't working in this browser..." after 4 s, then the on-device fallback. |
| Mic very quiet for 5 seconds | "We can't hear much. Move closer to the mic, or check it isn't muted." |

## In the map game

The checkpoint pops up as a short live interview: the character (or a pixel "Hiring panel") with the question on one side, the candidate's camera preview on the other. Video is the default. The first checkpoint of a run doubles as a camera check ("this is how you'll appear"), with "Voice instead" and "Text instead" right under the preview. The think timer only starts once the camera or mic is on, so a permission prompt never eats think time (capped at 20 seconds). The choice is remembered for the rest of the run.

On stage: if camera and mic are already allowed for the site, there is no extra step. The camera starts in about half a second, the timer starts, and the "Camera check" line just sits above the preview. If not allowed yet, the browser's permission prompt shows with the first checkpoint and the timer waits. Before a demo, open the game once on the presenting laptop and allow the camera.

Mic meter during the camera check: the meter reads the same microphone stream the camera check opens (Web Audio analyser on the getUserMedia audio track), so it moves before the first answer starts. In tests, Chromium's fake device plays a short beep about once a second, so the bars only flick briefly; `checkpoint-media.spec.ts` asserts the level goes above zero. It was not tried with a physical microphone in the cloud test environment, so check it on the stage laptop.

Pre-stage check: say a word during the camera check; the mic bars should move. Candidates with text-only accommodations never see the camera. Timer multipliers (1.5x, 2x) apply as everywhere else.

## Testing

`tests/e2e/checkpoint-media.spec.ts` runs Chromium with fake camera and mic and a scripted `SpeechRecognition`: restart after the browser stops, interim captions, `not-allowed`, no recognition at all (Firefox), camera denied, mic denied, and the game interview layout with axe. `lib/checkpoint/speech.test.ts` covers restart and error rules.

`tests/e2e/real-asr.spec.ts` (opt-in, `REAL_ASR=1`) is the real check: spoken audio (`tests/fixtures/audio/answer-speech.wav`, made with espeak-ng) plays through the fake microphone, the browser's real speech API never starts (test Chromium has no speech service, like Brave), and the real Whisper model must produce most of the spoken words, in voice and video mode. It passes against `pnpm dev` and the production build (`pnpm build && pnpm start`). The other specs stub the model (`window.__tpLocalAsr`) so they never download it.
