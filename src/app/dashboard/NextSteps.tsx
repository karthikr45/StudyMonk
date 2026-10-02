'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRemote } from '@/lib/client/useRemote';
export default function NextSteps({ userId }: { userId: string }) {
  const { data } = useRemote<{
    assessments: {
      id: string;
      title: string;
      myAttempt: { status: string } | null;
    }[];
  }>('/api/content/assessments');
  const [recent, setRecent] = useState<{ id: string; name: string } | null>(
    null,
  );
  useEffect(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem(`sm-recent-${userId}`) || 'null',
      );
      if (typeof value?.id === 'string' && typeof value?.name === 'string')
        setRecent(value);
    } catch {}
  }, [userId]);
  const resume = data?.assessments.find(
    (a) => a.myAttempt?.status === 'IN_PROGRESS',
  );
  const pending =
    data?.assessments.filter((a) => a.myAttempt?.status === 'NEEDS_REVIEW')
      .length ?? 0;
  return (
    <div className="next-step-hero">
      <span className="eyebrow">YOUR LEARNING, YOUR PACE</span>
      <h2 className="mt-4 max-w-md text-3xl sm:text-4xl font-bold">
        Small steps.
        <br />
        Big possibilities.
      </h2>
      <div className="relative z-10 mt-6 flex flex-wrap gap-3">
        {recent && (
          <Link
            className="btn"
            href={`/dashboard/subject/${encodeURIComponent(recent.id)}`}
          >
            Continue {recent.name}
          </Link>
        )}
        {resume ? (
          <Link className="btn" href={`/dashboard/assessment/${resume.id}`}>
            Resume {resume.title}
          </Link>
        ) : (
          <Link className="btn-ghost" href="/dashboard?tab=assess">
            Find an assessment
          </Link>
        )}
        {pending > 0 && (
          <Link className="btn-ghost" href="/dashboard?tab=assess">
            {pending} awaiting review
          </Link>
        )}
      </div>
      <p className="mt-4 max-w-sm text-sm text-teal-100">
        Choose a subject below to study at your own pace.
      </p>
    </div>
  );
}
