'use client';
import { CSSProperties, useEffect, useState } from 'react';
export default function FocusTimer({ userId }: { userId: string }) {
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(`sm-focus-${userId}`) || 'null',
      );
      if (
        saved &&
        [1500, 300].includes(saved.duration) &&
        Number.isFinite(saved.remaining) &&
        saved.remaining >= 0 &&
        saved.remaining <= saved.duration &&
        (saved.deadline === null || Number.isFinite(saved.deadline))
      ) {
        setDuration(saved.duration);
        setRemaining(
          saved.deadline
            ? Math.max(
                0,
                Math.min(
                  saved.duration,
                  Math.ceil((saved.deadline - Date.now()) / 1000),
                ),
              )
            : saved.remaining,
        );
        setDeadline(saved.deadline);
        setFinished(Boolean(saved.finished));
      }
    } catch {}
    setReady(true);
  }, [userId]);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem(
          `sm-focus-${userId}`,
          JSON.stringify({ duration, remaining, deadline, finished }),
        );
      } catch {}
  }, [ready, userId, duration, remaining, deadline, finished]);
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) {
        setDeadline(null);
        setFinished(true);
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline]);
  function choose(seconds: number) {
    setDuration(seconds);
    setRemaining(seconds);
    setDeadline(null);
    setFinished(false);
  }
  return (
    <aside className="focus-card" aria-label="Focus timer">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">A little focus goes far</span>
        <span aria-hidden="true">◷</span>
      </div>
      <div className="my-4 flex gap-2">
        {[
          [25 * 60, 'Focus'],
          [5 * 60, 'Break'],
        ].map(([seconds, label]) => (
          <button
            key={label}
            aria-pressed={duration === seconds}
            className={`focus-mode ${duration === seconds ? 'active' : ''}`}
            onClick={() => choose(Number(seconds))}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className={`focus-orbit ${deadline ? 'is-running' : ''} ${finished ? 'is-finished' : ''}`}
        style={
          {
            '--focus-progress': `${((duration - remaining) / duration) * 360}deg`,
          } as CSSProperties
        }
      >
        <p
          className="timer-digits"
          aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`}
        >
          {String(Math.floor(remaining / 60)).padStart(2, '0')}
          <span>:</span>
          {String(remaining % 60).padStart(2, '0')}
        </p>
      </div>
      <p className="my-3 text-sm text-slate-600" role="status">
        {finished
          ? 'Session complete. Take a breath — you earned it.'
          : 'One thing at a time. You’ve got this.'}
      </p>
      <div className="flex gap-2">
        <button
          disabled={!ready}
          className="btn flex-1"
          onClick={() => {
            if (deadline) setDeadline(null);
            else {
              const seconds = remaining || duration;
              setRemaining(seconds);
              setDeadline(Date.now() + seconds * 1000);
              setFinished(false);
            }
          }}
        >
          {deadline
            ? 'Pause'
            : remaining < duration && remaining > 0
              ? 'Continue'
              : 'Start session'}{' '}
          {deadline ? 'Ⅱ' : '→'}
        </button>
        <button className="btn-ghost" onClick={() => choose(duration)}>
          Reset
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Personal timer · saved in this browser tab
      </p>
    </aside>
  );
}
