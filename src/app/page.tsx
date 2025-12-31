"use client";

import confetti from "canvas-confetti";
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase, supabaseConfig } from "@/lib/supabaseClient";

type BlessingRow = {
  id: string;
  room_id: string;
  name: string | null;
  text: string;
  created_at: string;
};

type BlessingBubble = {
  id: string;
  name: string | null;
  text: string;
  created_at: string;
  x: number;
  y: number;
  hue: number;
  tilt: number;
};

type ConfettiPiece = {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  hue: number;
};

const ROOM_ID = "global";
const BASE_TARGET_TIME = new Date("2026-01-01T00:00:00+09:00").getTime();

const formatRemaining = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min;

export default function Home() {
  const [targetTime, setTargetTime] = useState(BASE_TARGET_TIME);
  const [remaining, setRemaining] = useState(() =>
    Math.max(BASE_TARGET_TIME - Date.now(), 0)
  );
  const [blessings, setBlessings] = useState<BlessingBubble[]>([]);
  const [anonymous, setAnonymous] = useState(true);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [cooldown, setCooldown] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  const hasConfig = useMemo(
    () => Boolean(supabaseConfig.url && supabaseConfig.anonKey),
    []
  );
  const knownIds = useRef(new Set<string>());
  const timeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const panelRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef({ width: 0, height: 0 });

  const confettiPieces = useMemo<ConfettiPiece[]>(() => {
    return Array.from({ length: 26 }, (_, index) => ({
      id: index,
      left: randomBetween(0, 100),
      size: randomBetween(4, 8),
      delay: randomBetween(0, 8),
      duration: randomBetween(7, 12),
      opacity: randomBetween(0.4, 0.85),
      hue: Math.round(randomBetween(10, 340)),
    }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testValue = Number(params.get("test"));
    if (Number.isFinite(testValue) && testValue > 0) {
      setTargetTime(Date.now() + testValue * 10000);
      setHasCelebrated(false);
      setShowOverlay(false);
    }
  }, []);

  useEffect(() => {
    setRemaining(Math.max(targetTime - Date.now(), 0));
    const interval = setInterval(() => {
      setRemaining(Math.max(targetTime - Date.now(), 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  useEffect(() => {
    const updateViewport = () => {
      viewportRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const updatePanelHeight = () => {
      const height = panel.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--panel-height",
        `${height}px`
      );
    };

    updatePanelHeight();
    const observer = new ResizeObserver(updatePanelHeight);
    observer.observe(panel);
    window.addEventListener("resize", updatePanelHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePanelHeight);
    };
  }, []);

  const pickBubblePosition = useCallback(() => {
    const { width, height } = viewportRef.current;
    const size = Math.min(width, height);
    if (!size) {
      return { x: randomBetween(8, 82), y: randomBetween(12, 62) };
    }

    const minRadius = size * 0.18;
    const maxRadius = size * 0.42;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const angle = randomBetween(0, Math.PI * 2);
      const radius = randomBetween(minRadius, maxRadius);
      const xPx = centerX + Math.cos(angle) * radius;
      const yPx = centerY + Math.sin(angle) * radius;
      const xPercent = (xPx / width) * 100;
      const yPercent = (yPx / height) * 100;

      if (
        xPercent >= 4 &&
        xPercent <= 96 &&
        yPercent >= 6 &&
        yPercent <= 90
      ) {
        return { x: xPercent, y: yPercent };
      }
    }

    return { x: randomBetween(8, 82), y: randomBetween(12, 62) };
  }, []);

  const createBubble = useCallback(
    (row: BlessingRow): BlessingBubble => {
      const { x, y } = pickBubblePosition();
      return {
        id: row.id,
        name: row.name?.trim() || null,
        text: row.text,
        created_at: row.created_at,
        x,
        y,
        hue: Math.round(randomBetween(15, 320)),
        tilt: Math.round(randomBetween(-6, 6)),
      };
    },
    [pickBubblePosition]
  );

  const addBlessing = useCallback(
    (row: BlessingRow) => {
      if (knownIds.current.has(row.id)) {
        return;
      }
      knownIds.current.add(row.id);
      const bubble = createBubble(row);
      setBlessings((prev) => [...prev, bubble]);
      const timeout = setTimeout(() => {
        setBlessings((prev) => prev.filter((item) => item.id !== row.id));
        knownIds.current.delete(row.id);
        timeouts.current.delete(row.id);
      }, 5000);
      timeouts.current.set(row.id, timeout);
    },
    [createBubble]
  );

  const runConfetti = useCallback(() => {
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 6,
        spread: 65,
        angle: 60,
        origin: { x: 0, y: 0.7 },
      });
      confetti({
        particleCount: 6,
        spread: 65,
        angle: 120,
        origin: { x: 1, y: 0.7 },
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

  useEffect(() => {
    if (remaining > 0 || hasCelebrated) {
      return;
    }
    setHasCelebrated(true);
    setShowOverlay(true);
    runConfetti();
    const timer = setTimeout(() => setShowOverlay(false), 1500);
    return () => clearTimeout(timer);
  }, [remaining, hasCelebrated, runConfetti]);

  useEffect(() => {
    if (!hasConfig) {
      setStatusMessage("Supabase 설정이 필요해요. 환경변수를 확인해 주세요.");
      return;
    }

    const loadBlessings = async () => {
      const { data, error } = await supabase
        .from("blessings")
        .select("id, room_id, name, text, created_at")
        .eq("room_id", ROOM_ID)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        setStatusMessage(
          "덕담을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
        );
        return;
      }

      data?.forEach(addBlessing);
    };

    loadBlessings();

    const channel = supabase
      .channel("blessings-global")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "blessings",
          filter: `room_id=eq.${ROOM_ID}`,
        },
        (payload) => {
          const row = payload.new as BlessingRow;
          addBlessing(row);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [addBlessing, hasConfig]);

  useEffect(() => {
    return () => {
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      timeouts.current.clear();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cooldown) {
      return;
    }

    if (!hasConfig) {
      setStatusMessage("Supabase 설정이 필요해요. 환경변수를 확인해 주세요.");
      return;
    }

    const trimmedText = text.trim();
    const trimmedName = name.trim();

    if (!trimmedText) {
      setStatusMessage("덕담을 입력해 주세요.");
      return;
    }

    if (!anonymous && !trimmedName) {
      setStatusMessage("닉네임을 입력해 주세요.");
      return;
    }

    setCooldown(true);
    setStatusMessage(null);

    const { error } = await supabase.from("blessings").insert({
      room_id: ROOM_ID,
      name: anonymous ? null : trimmedName,
      text: trimmedText,
    });

    if (error) {
      setStatusMessage("전송 중 오류가 발생했어요. 다시 시도해 주세요.");
    } else {
      setText("");
      setStatusMessage("덕담이 전송됐어요!");
    }

    setTimeout(() => setCooldown(false), 3000);
  };

  const remainingSeconds = Math.ceil(remaining / 1000);
  const phaseClass =
    remainingSeconds <= 10
      ? "phase-10"
      : remainingSeconds <= 30
        ? "phase-30"
        : remainingSeconds <= 60
          ? "phase-60"
          : "phase-normal";
  const isNewYear = remaining === 0;

  return (
    <div className={`app-shell ${phaseClass}`}>
      {hasCelebrated && (
        <div className="confetti-drift" aria-hidden="true">
          {confettiPieces.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece"
              style={
                {
                  left: `${piece.left}%`,
                  width: `${piece.size}px`,
                  height: `${piece.size * 1.6}px`,
                  opacity: piece.opacity,
                  background: `hsl(${piece.hue} 85% 70%)`,
                  animationDelay: `${piece.delay}s`,
                  animationDuration: `${piece.duration}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      <div className="main-content relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 pt-16 text-center sm:px-10">
        <span className="rounded-full border border-white/60 bg-white/70 px-4 py-1 text-sm font-semibold text-slate-700 shadow-sm">
          Happy New Year 2026
        </span>
        <h1 className="mt-6 text-2xl font-semibold text-slate-700">
          {isNewYear ? (
            <>
              새해 복 많이 받으세요! {"\u{1F389}"}
            </>
          ) : (
            <>
              함께 새해를 기다리며,
              <br className="only-mobile" /> 덕담을 나눠요 {"\u2764\uFE0F"}
            </>
          )}
        </h1>
        <div className="countdown-layer">
          <div className="countdown mt-6 text-slate-900">
            {formatRemaining(remaining)}
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-base text-slate-600">
          보내진 덕담은 화면 곳곳에 말풍선으로 떠오르며 5초 뒤 사라집니다.
        </p>

        <div className="bubble-layer pointer-events-none absolute inset-0">
          {blessings.map((bubble) => (
            <div
              key={bubble.id}
              className="bubble"
              style={
                {
                  left: `${bubble.x}%`,
                  top: `${bubble.y}%`,
                  "--hue": bubble.hue,
                  "--tilt": `${bubble.tilt}deg`,
                } as CSSProperties
              }
            >
              {bubble.name && (
                <span className="bubble-name">{bubble.name}</span>
              )}
              <span className="bubble-text">{bubble.text}</span>
            </div>
          ))}
        </div>

        {showOverlay && (
          <div className="overlay-celebration pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-white/80 px-8 py-4 text-4xl font-semibold text-slate-900 shadow-lg">
              {"\u{1F386} 2026 \u{1F386}"}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="input-dock fixed left-1/2 z-40 flex w-full -translate-x-1/2 flex-col gap-3 px-4"
      >
        <div ref={panelRef} className="input-panel mx-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-700 sm:justify-start">
            <label className="flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(event) => setAnonymous(event.target.checked)}
                className="h-4 w-4 accent-orange-400"
              />
              익명으로 보내기
            </label>
            {!anonymous && (
              <input
                type="text"
                value={name}
                maxLength={12}
                onChange={(event) => setName(event.target.value)}
                placeholder="닉네임 (최대 12자)"
                className="panel-field w-full sm:w-52"
              />
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={text}
              maxLength={30}
              onChange={(event) => setText(event.target.value)}
              placeholder="덕담을 입력해 주세요 (최대 30자)"
              className="panel-field h-16 flex-1 resize-none"
            />
            <button
              type="submit"
              className="send-button h-11 px-6"
              disabled={cooldown || !text.trim()}
            >
              {cooldown ? "전송 대기..." : "보내기"}
            </button>
          </div>

          {statusMessage && (
            <div className="text-sm font-semibold text-slate-600">
              {statusMessage}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
