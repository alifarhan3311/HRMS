import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardDetailsLink({ to, label = 'View Details' }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      {label}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}
