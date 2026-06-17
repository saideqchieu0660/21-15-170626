import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { store } from "../lib/store";

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  if (pathnames.length === 0) return null;

  return (
    <nav className="flex items-center space-x-1 text-sm text-zinc-500 dark:text-zinc-400 my-4" aria-label="Breadcrumb">
      <Link to="/dashboard" className="hover:text-orange-500 transition">Dashboard</Link>
      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;

        let displayName = value.replace(/-/g, " ");
        let isDeckTitle = false;

        if (index > 0 && pathnames[index - 1] === "study") {
          const resolvedTitle = store.getRawDeckTitle(value);
          if (resolvedTitle) {
            displayName = resolvedTitle;
            isDeckTitle = true;
          }
        }

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-4 h-4" />
            {last ? (
              <span className={`font-medium text-zinc-800 dark:text-zinc-200 ${isDeckTitle ? "" : "capitalize"}`}>{displayName}</span>
            ) : (
              <Link to={to} className={`hover:text-orange-500 transition ${isDeckTitle ? "" : "capitalize"}`}>{displayName}</Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
