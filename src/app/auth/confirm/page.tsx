import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { verifyLink } from "./actions";
import { SubmitButton } from "./SubmitButton";

const TOKEN_HASH = /^[A-Za-z0-9_-]{10,200}$/;

/**
 * Landing page for invite and password-reset emails. The one-time token is
 * only redeemed when the person clicks Continue (a POST), not on page load,
 * so email security scanners that pre-open links can't burn the token.
 */
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const { token_hash, type } = await searchParams;
  if (typeof token_hash !== "string" || !TOKEN_HASH.test(token_hash) || (type !== "invite" && type !== "recovery")) {
    redirect("/login?error=link");
  }

  const { t } = await getDictionary();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form action={verifyLink} className="w-full max-w-sm space-y-4 rounded-xl bg-surface p-8">
        <h1 className="text-2xl font-bold">{t.confirm.title}</h1>
        <p className="text-sm text-muted">{t.confirm.subtitle}</p>
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
        <SubmitButton label={t.confirm.submit} pendingLabel={t.confirm.submitting} />
      </form>
    </main>
  );
}
