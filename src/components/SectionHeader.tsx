import { Link } from 'react-router-dom';

interface Props {
  label?: string;
  title: string;
  subtitle?: string;
  linkTo?: string;
  linkText?: string;
}

export function SectionHeader({ label, title, subtitle, linkTo, linkText }: Props) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 md:mb-10">
      <div>
        {label && <p className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-accent">{label}</p>}
        <h2 className="font-heading text-[26px] font-semibold uppercase leading-[1.05] tracking-[1px] text-text md:text-[40px]">
          {title}
        </h2>
        {subtitle && <p className="mt-3 max-w-xl text-[14px] text-muted md:text-[15px]">{subtitle}</p>}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="shrink-0 whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.5px] text-muted transition-colors hover:text-accent"
        >
          {linkText ?? 'Ver todo'}
        </Link>
      )}
    </div>
  );
}
