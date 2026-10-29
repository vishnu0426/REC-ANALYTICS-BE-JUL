"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Play, Pause } from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { TimelineEvent, formatDuration } from "@/lib/api";

export interface AudioPlayerHandle {
  seekTo: (seconds: number) => void;
}

const EVENT_COLOR: Record<string, string> = {
  greeting: "#2F6FED",
  verification: "#2F6FED",
  issue: "#9C6510",
  investigation: "#9C6510",
  solution: "#12805A",
  confirmation: "#12805A",
  closing: "#6C7488",
};

/**
 * Audio is never proxied through our own API for playback — this element's
 * source is a short-lived MinIO presigned URL (see /calls/{id}/audio), so
 * the browser streams the recording directly from object storage.
 */
const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  { audioUrl: string; duration: number; events: TimelineEvent[]; peaks?: number[] | null; onError?: () => void }
>(
  ({ audioUrl, duration, events, peaks, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WaveSurfer | null>(null);
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const [current, setCurrent] = useState(0);
    const [total, setTotal] = useState(duration);
    const [playing, setPlaying] = useState(false);
    const [ready, setReady] = useState(false);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        const ws = wsRef.current;
        if (!ws) return;
        const d = ws.getDuration();
        if (d > 0) ws.seekTo(Math.min(seconds / d, 1));
        ws.play();
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;
      const regions = RegionsPlugin.create();
      // With server-precomputed peaks + a known duration, wavesurfer draws
      // the waveform immediately and the <audio> element streams the file on
      // demand — no download-and-decode of the whole recording up front,
      // which is what made long calls take ~10s+ to show a player.
      const instant = !!(peaks && peaks.length > 0 && duration > 0);
      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "#E2E5EC",
        progressColor: "#2F6FED",
        cursorColor: "#171B24",
        height: 56,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        url: audioUrl,
        peaks: instant ? [peaks as number[]] : undefined,
        duration: instant ? duration : undefined,
        plugins: [regions],
      });
      wsRef.current = ws;

      const addEventRegions = () => {
        events.forEach((e) => {
          regions.addRegion({
            start: e.start_time,
            end: e.end_time ?? e.start_time + 0.5,
            color: `${EVENT_COLOR[e.event_type] || "#6C7488"}33`,
            drag: false,
            resize: false,
            content: e.event_type,
          });
        });
      };

      if (instant) {
        setTotal(duration);
        setReady(true);
        addEventRegions();
      }
      ws.on("ready", (dur) => {
        setTotal(dur);
        if (!instant) {
          setReady(true);
          addEventRegions();
        }
      });
      ws.on("timeupdate", (t) => setCurrent(t));
      ws.on("play", () => setPlaying(true));
      ws.on("pause", () => setPlaying(false));
      // Fires when the media fails to load or decode — most commonly an
      // expired presigned URL (30 min TTL) or MinIO being unreachable. The
      // parent reacts by re-minting a fresh URL; without this handler the
      // player would just sit dimmed and disabled forever.
      ws.on("error", () => {
        setReady(false);
        onErrorRef.current?.();
      });

      return () => {
        ws.destroy();
        wsRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioUrl]);

    return (
      <div className="bg-panel border border-hairline rounded-lg px-5 py-4">
        <div ref={containerRef} className={`mb-3 ${ready ? "" : "opacity-40"}`} />

        <div className="flex items-center gap-4">
          <button
            onClick={() => wsRef.current?.playPause()}
            disabled={!ready}
            className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white shrink-0 disabled:opacity-50"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
          </button>
          <div className="font-mono text-[12px] text-muted tabular">
            {formatDuration(current)} / {formatDuration(total)}
          </div>
          <div className="flex-1" />
          <div className="flex gap-3 text-[11px] text-faint">
            {Object.entries(EVENT_COLOR).slice(0, 4).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: v }} />
                {k}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

AudioPlayer.displayName = "AudioPlayer";
export default AudioPlayer;
