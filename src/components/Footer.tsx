import { IconLogo } from './icons';
import PoweredByLogo from './PoweredByLogo';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-slate-200/70 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
            <IconLogo width={16} height={16} />
          </span>
          <span className="text-sm text-slate-500">
            © {year} <span className="font-semibold text-slate-700">StudyMonk</span>. All rights reserved.
          </span>
        </div>

        <div className="flex items-center gap-5 text-sm">
          <a
            href="https://mktechmonk.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 transition-colors hover:text-brand-600"
          >
            Contact us
          </a>
          <a
            href="https://mktechmonk.in"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
          >
            <span className="text-slate-400">Powered by</span>
            <PoweredByLogo />
            <span className="text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5">↗</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
