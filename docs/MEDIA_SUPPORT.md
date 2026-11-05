# Voice and video answers: browser support

Checkpoints can be answered by video, voice or text. Only the words are scored. Nothing about the face, voice tone, accent or fluency is measured. Text works in every browser.

## How voice transcription works

The demo has no API keys, so speech to text uses the browser's built-in `SpeechRecognition` (`lib/checkpoint/speech.ts`, `components/checkpoint/useRecorder.ts`).

- It keeps listening for the whole answer. Browsers stop recognition after a few seconds of silence or about a minute; we start it again until the candidate presses Done or time runs out.
- Words show live as captions while the candidate speaks (interim results in lighter text).
- A mic level meter shows during the think time and the answer, so the candidate can see the mic works. Loudness is only drawn on screen, never stored or scored.
- After the answer, the candidate sees "What we heard" in an editable box and can fix misheard words or type what they said. That text is what is saved and scored. Paste is off in that box, same as text answers.
- The recording is kept either way (unless the candidate deletes or hides it later).
- If they change any words, the card keeps the original speech-to-text text (`recognizedText`) and adds an integrity note: "Transcript corrected before submit: N words changed (context, not scored)". Recruiters can open the original under the clip. Evidence quotes still have to match the submitted transcript exactly. Transcripts can't be edited after submit (C7.2).

## By browser

| Browser | Recording | Live speech to text | What the candidate sees |
| --- | --- | --- | --- |
| Chrome (desktop, Android) | Yes | Yes. Audio goes to Google's speech service, so it needs internet. | Live captions, mic meter, editable transcript. If the connection drops: "Speech to text needs an internet connection in this browser and it dropped..." and they type or fix the words after. |
| Edge (desktop) | Yes | Yes (Microsoft's service, needs internet) | Same as Chrome. |
| Safari (macOS 14.1+, iOS 17+) | Yes | Partly. Works, but can stop early or miss words, and iOS may hand the mic to one or the other. | Captions when it works. Restarts happen by themselves. Any gaps get fixed in the editable transcript. |
| Firefox | Yes | No | Before answering: "This browser can't turn speech into text. We'll still record your answer, and you type what you said before you submit. Chrome and Edge transcribe live." The recording is kept; the transcript box starts empty. |
| Brave, privacy builds of Chromium | Yes | Often blocked (`not-allowed` or `network`) | "Your browser blocked speech to text..." and they type the words. |
| Any browser, camera or mic blocked | Camera blocked: falls back to voice. Mic blocked: falls back to text. | n/a | A calm note, for example "The browser didn't allow the camera. This one is set to voice, which counts exactly the same. You can switch any time." Never an error tone. |

## Errors in plain words

| Recognition error | What happens |
| --- | --- |
| `no-speech`, `aborted` | Silent restart. Nothing shown. |
| `network` | Up to 3 silent retries, then a message. |
| `not-allowed`, `service-not-allowed` | Message, recording continues, type the words after. |
| `audio-capture` | "We can't reach a microphone for speech to text..." |
| Mic very quiet for 5 seconds | "We can't hear much. Move closer to the mic, or check it isn't muted." |

## In the map game

The checkpoint pops up as a short live interview: the character (or a pixel "Hiring panel") with the question on one side, the candidate's camera preview on the other. Video is the default. The first checkpoint of a run doubles as a camera check ("this is how you'll appear"), with "Voice instead" and "Text instead" right under the preview. The think timer only starts once the camera or mic is on, so a permission prompt never eats think time (capped at 20 seconds). The choice is remembered for the rest of the run.

On stage: if camera and mic are already allowed for the site, there is no extra step. The camera starts in about half a second, the timer starts, and the "Camera check" line just sits above the preview. If not allowed yet, the browser's permission prompt shows with the first checkpoint and the timer waits. Before a demo, open the game once on the presenting laptop and allow the camera. Candidates with text-only accommodations never see the camera. Timer multipliers (1.5x, 2x) apply as everywhere else.

## Testing

`tests/e2e/checkpoint-media.spec.ts` runs Chromium with fake camera and mic and a scripted `SpeechRecognition`: restart after the browser stops, interim captions, `not-allowed`, no recognition at all (Firefox), camera denied, mic denied, and the game interview layout with axe. `lib/checkpoint/speech.test.ts` covers restart and error rules.
