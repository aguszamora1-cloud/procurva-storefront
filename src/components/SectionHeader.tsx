import { Link } from 'react-router-dom';

interface Props {
  label?: string;
  title: string;
  linkTo?: string;
  linkText?: string;
}

export function SectionHeader({ label, title, linkTo, linkText }: Props) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        {label && <p className="subtitle-label mb-1 text-muted">{label}</p>}
        <h2>{title}</h2>
      </div>
      {linkTo && (
        <Link to={linkTo} className="nav-link shrink-0 text-text hover:text-accent">
          {linkText ?? 'Ver todo'}
        </Link>
      )}
    </div>
  );
}
