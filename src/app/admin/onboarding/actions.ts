"use server";

import { adminContext, done, fail, text, type ActionState } from "@/lib/admin/actions-common";
import { isLocale } from "@/lib/i18n/config";

const VERSION = /^[0-9A-Za-z.-]{1,20}$/;

export async function publishOnboardingTemplate(_: ActionState, form: FormData): Promise<ActionState> {
  const { db, audit } = await adminContext();
  const version = text(form, "version", 20);
  const locale = text(form, "locale", 10);
  const subject = text(form, "subject", 200);
  const body = text(form, "body", 50_000);

  if (!VERSION.test(version)) return fail("Version must be letters, numbers, dots or dashes (e.g. 1.0).");
  if (!isLocale(locale)) return fail("Invalid language.");
  if (!subject) return fail("Subject is required.");
  if (!body.includes("{{code}}")) return fail("The body must include {{code}} so the affiliate gets their code.");

  const { data, error } = await db.rpc("publish_onboarding_template", {
    p_version: version,
    p_locale: locale,
    p_subject: subject,
    p_body_md: body,
  });

  if (error) {
    if (error.code === "23505") return fail(`Version ${version} already exists for this language.`);
    return fail("Could not publish the template.");
  }

  await audit("onboarding_template.published", "onboarding_template", data, { version, locale });
  return done(`Published template ${version} (${locale}).`);
}
