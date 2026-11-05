"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CardCheckpoint } from "@/lib/card/types";
import { media } from "@/lib/store/media";

export type ClipHandle = { seek: (seconds: number) => void };

/**
 * Plays a checkpoint recording from this device and jumps to a given second (E3.4).
 * "Transcript first" hides the video until the reviewer chooses to reveal it (E6.2).
 * Text answers have no media; the transcript is the answer.
 */
export const ClipPlayer = forwardRef<ClipHandle, { checkpoint: CardCheckpoint; transcriptFirst?: boolean }>(function ClipPlayer(
  { checkpoint, transcriptFirst = false },
  ref,
) {
  const el = useRef<HTMLVideoElement | null>(null);
  const [src, setSrc] = useState<string>();
  const [revealed, setRevealed] = useState(!transcriptFirst);
  const [activeWord, setActiveWord] = useState(-1);

  useEffect(() => {
    let url: string | undefined;
    let alive = true;
    if (checkpoint.media) {
      // Demo seed clips are static files; candidate recordings live in IndexedDB and play only
      // through a 1-hour signed link (PV3).
      if (checkpoint.media.startsWith("demo/")) setSrc(`/${checkpoint.media}`);
      else
        media
          .signedUrl(checkpoint.media)
          .then(media.playbackUrl)
          .then((u) => {
            url = u;
            if (alive) setSrc(u);
            else if (u) URL.revokeObjectURL(u);
          })
          .catch(() => {});
    }
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [checkpoint.media]);

  const seek = (t: number) => {
    setRevealed(true);
    const v = el.current;
    if (!v) return;
    v.currentTime = t;
    v.play().catch(() => {});
  };
  useImperativeHandle(ref, () => ({ seek }));

  const onTime = () => {
    const t = el.current?.currentTime ?? 0;
    setActiveWord(checkpoint.transcript.words.findIndex((w) => t >= w.start && t <= w.end + 0.15));
  };

  const isVideo = checkpoint.mode === "video";
  return (
    <div className="space-y-2" data-testid={`clip-${checkpoint.id}`}>
      {checkpoint.media && src && (
        <div className={revealed ? "" : "hidden"}>
          {isVideo ? (
            <video ref={el} src={src} controls playsInline onTimeUpdate={onTime} className="aspect-video w-full rounded-xl bg-black" data-testid="clip-media" />
          ) : (
            <audio ref={el as unknown as React.Ref<HTMLAudioElement>} src={src} controls onTimeUpdate={onTime} className="w-full" data-testid="clip-media" />
          )}
        </div>
      )}
      {checkpoint.media && isVideo && !revealed && (
        <button onClick={() => setRevealed(true)} className="rounded-full border px-3 py-1 text-sm">
          Reveal video
        </button>
      )}
      <p className="max-h-32 overflow-y-auto text-sm leading-relaxed" tabIndex={0} aria-label="Transcript">
        {checkpoint.transcript.words.length
          ? checkpoint.transcript.words.map((w, i) => [
              i > 0 ? " " : null,
              <button
                key={i}
                type="button"
                onClick={() => seek(w.start)}
                className={`rounded px-0.5 hover:bg-black/5 dark:hover:bg-white/10 ${i === activeWord ? "bg-amber-200 dark:bg-amber-700/50" : ""}`}
                aria-label={`${w.w}, jump to ${Math.floor(w.start)} seconds`}
              >
                {w.w}
              </button>,
            ])
          : checkpoint.transcript.text || <em>Transcript unavailable.</em>}
      </p>
    </div>
  );
});
