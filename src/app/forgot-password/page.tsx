import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getDictionary } from "@/lib/i18n/server";
import { ForgotForm } from "./ForgotForm";

export default async function ForgotPasswordPage() {
  const { locale, t } = await getDictionary();

  return (
    <main className="relative flex flex-1 items-center justify-center p-6">
      <div className="absolute right-4 top-4">
        <LanguageSwitch current={locale} label={t.common.language} />
      </div>
      <ForgotForm t={t.forgot} captchaError={t.login.captchaError} locale={locale} />
    </main>
  );
}
