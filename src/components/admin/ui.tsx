import type { ComponentProps, ReactNode } from "react";

/** Small shared building blocks for the admin console. */

export const inputClass =
  "w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm disabled:opacity-60";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-accent text-background font-semibold",
    secondary: "border border-white/10 hover:bg-white/5",
    danger: "border border-red-400/40 text-red-300 hover:bg-red-400/10",
  }[variant];
  return (
    <button
      type="submit"
      {...props}
      className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl bg-surface p-5">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "accent" | "warn" | "danger" }) {
  const styles = {
    muted: "bg-white/5 text-muted",
    accent: "bg-accent/15 text-accent",
    warn: "bg-amber-400/15 text-amber-300",
    danger: "bg-red-400/15 text-red-300",
  }[tone];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs capitalize ${styles}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export const commissionTone = {
  pending: "muted",
  qualified: "accent",
  paid: "accent",
  forfeited: "danger",
  ineligible: "warn",
} as const;
