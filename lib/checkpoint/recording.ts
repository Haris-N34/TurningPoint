/** A recording format this browser supports: webm in Chrome, Edge and Firefox, mp4 in Safari. */
export function pickMime(video: boolean, isSupported: (t: string) => boolean = (t) => typeof MediaRecorder !== "undefined" && !!MediaRecorder.isTypeSupported?.(t)) {
  const options = video ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"] : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  const mimeType = options.find((t) => {
    try {
      return isSupported(t);
    } catch {
      return false;
    }
  });
  return mimeType ? { mimeType } : undefined;
}
