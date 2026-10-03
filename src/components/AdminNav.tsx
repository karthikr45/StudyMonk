'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const destinations = [
  ['/admin', 'Overview & catalog', '01'],
  ['/admin/assessments', 'Assessments', '02'],
  ['/admin/groups', 'Study groups', '03'],
  ['/admin/analytics', 'Analytics', '04'],
  ['/admin/schools', 'Schools', '05'],
  ['/admin/enrollments', 'Batches & enrollments', '06'],
];
export default function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin workspace" className="admin-nav">
      {destinations.map(([href, label, number]) => {
        const active =
          href === '/admin' ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={active ? 'active' : ''}
          >
            <span aria-hidden="true">{number}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
