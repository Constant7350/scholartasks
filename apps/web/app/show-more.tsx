"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Long lists show the first few and a "Show all" button, so phones don't scroll forever. Resets when `reset` changes (a new search or filter). */
export function useShowMore<T>(list: T[], first = 10, reset?: unknown): { shown: T[]; more: ReactNode } {
  const [all, setAll] = useState(false);
  useEffect(() => { setAll(false); }, [reset]);
  if (all || list.length <= first + 2) return { shown: list, more: null };
  return {
    shown: list.slice(0, first),
    more: (
      <p className="show-more">
        <button type="button" className="btn btn-ghost btn-inline" onClick={() => setAll(true)}>Show all {list.length}</button>
      </p>
    ),
  };
}

/** A list that shows the first few rows and a "Show all" button. */
export function MoreList<T>({ items, first = 6, render, className }: { items: T[]; first?: number; render: (item: T) => ReactNode; className?: string }) {
  const { shown, more } = useShowMore(items, first);
  return <><ul className={className}>{shown.map(render)}</ul>{more}</>;
}
