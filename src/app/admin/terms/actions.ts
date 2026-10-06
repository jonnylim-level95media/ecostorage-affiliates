"use server";

import { adminContext, done, fail, text, type ActionState } from "@/lib/admin/actions-common";
import { isLocale } from "@/lib/i18n/config";

const VERSION = /^[0-9A-Za-z.-]{1,20}$/;

export async function publishTerms(_: ActionState, form: FormData): Promise<ActionState> {
  const { db, audit } = await adminContext();
  const version = text(form, "version", 20);
  const locale = text(form, "locale", 10);
  const body = text(form, "body", 100_000);

  if (!VERSION.test(version)) return fail("Version must be letters, numbers, dots or dashes (e.g. 1.0).");
  if (!isLocale(locale)) return fail("Invalid language.");
  if (body.length < 50) return fail("The agreement text looks too short.");

  const { data, error } = await db.rpc("publish_terms_version", {
    p_version: version,
    p_locale: locale,
    p_body_md: body,
  });

  if (error) {
    if (error.code === "23505") return fail(`Version ${version} already exists for this language. Use a new version number.`);
    return fail(error.message);
  }

  await audit("terms.published", "terms_version", data, { version, locale });
  return done(`Published version ${version} (${locale}).`);
}
