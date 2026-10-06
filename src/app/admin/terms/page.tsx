import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Button, Card, Empty, Field, inputClass } from "@/components/admin/ui";
import { fmtDate } from "@/lib/admin/format";
import { publishTerms } from "./actions";

export default async function TermsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: versions }, { data: acceptances }] = await Promise.all([
    supabase.from("terms_versions").select("id, version, locale, is_current, published_at, body_md").order("published_at", { ascending: false }),
    supabase.from("terms_acceptances").select("governing_terms_version_id"),
  ]);

  const acceptedCount = new Map<string, number>();
  for (const a of acceptances ?? []) {
    if (a.governing_terms_version_id) {
      acceptedCount.set(a.governing_terms_version_id, (acceptedCount.get(a.governing_terms_version_id) ?? 0) + 1);
    }
  }
  const currentEn = versions?.find((v) => v.locale === "en" && v.is_current);
  const currentZh = versions?.find((v) => v.locale === "zh-Hans" && v.is_current);

  return (
    <>
      <h1 className="text-2xl font-bold">Affiliate agreement</h1>
      <p className="text-sm text-muted">
        English is the only binding version. A Chinese version is shown to affiliates only when its version number matches
        the current English version; otherwise they see English. Publishing a new version doesn&apos;t make existing
        affiliates re-accept automatically.
      </p>

      {currentEn && currentZh && currentZh.version !== currentEn.version && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
          Chinese version {currentZh.version} is out of date (English is {currentEn.version}). Chinese-language affiliates
          will see the English text until you publish Chinese version {currentEn.version}.
        </p>
      )}

      <Card title="Publish a new version">
        <ActionForm action={publishTerms} confirm="Publish this version as the current agreement for this language?" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Version (e.g. 1.0)">
              <input name="version" required placeholder={currentEn ? `after ${currentEn.version}` : "1.0"} className={inputClass} />
            </Field>
            <Field label="Language">
              <select name="locale" className={inputClass} defaultValue="en">
                <option value="en">English (binding)</option>
                <option value="zh-Hans">中文 (reference translation)</option>
              </select>
            </Field>
          </div>
          <Field label="Agreement text (Markdown)">
            <textarea name="body" required rows={14} className={`${inputClass} font-mono`} />
          </Field>
          <p className="text-xs text-muted">
            Publish English first; a Chinese version must use the same version number as an existing English one.
          </p>
          <Button>Publish</Button>
        </ActionForm>
      </Card>

      <Card title="All versions">
        {!versions?.length ? (
          <Empty>Nothing published yet.</Empty>
        ) : (
          <ul className="space-y-3">
            {versions.map((v) => (
              <li key={v.id} className="rounded-lg border border-white/5 p-3 text-sm">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                    <strong>v{v.version}</strong>
                    <span>{v.locale === "en" ? "English" : "中文"}</span>
                    {v.is_current && <Badge tone="accent">current</Badge>}
                    <span className="text-muted">published {fmtDate(v.published_at)}</span>
                    {v.locale === "en" && <span className="text-muted">· {acceptedCount.get(v.id) ?? 0} accepted</span>}
                  </summary>
                  <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-background p-3 text-xs">{v.body_md}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
