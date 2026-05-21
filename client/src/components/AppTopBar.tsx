import { Link } from "react-router-dom";
import { UserAccountMenu } from "./UserAccountMenu";

export function AppTopBar() {
  return (
    <div className="sticky top-0 z-[60] -mx-4 mb-8 border-b border-surface-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link
          to="/"
          className="font-display text-sm font-bold text-slate-400 transition hover:text-white"
        >
          Atlas Invest
        </Link>
        <UserAccountMenu />
      </div>
    </div>
  );
}
