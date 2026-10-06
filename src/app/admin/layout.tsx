import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/signups", label: "Signups" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/terms", label: "Terms" },
  { href: "/admin/onboarding", label: "Onboarding" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div lang="en" className="flex flex-1 flex-col">
      <header className="border-b border-white/5">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <span className="mr-3 font-bold">EcoStorage Admin</span>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md px-2.5 py-1.5 text-muted hover:bg-surface hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-6">{children}</main>
    </div>
  );
}
