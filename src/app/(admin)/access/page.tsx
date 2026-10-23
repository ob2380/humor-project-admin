import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/data";
import type { AllowedEmail, Domain } from "@/lib/domain";
import { PageHeader, Section, Empty, fmtDate } from "@/components/ui";
import { ActionForm, SubmitButton, DeleteButton, Field } from "@/components/forms";
import { createDomain, updateDomain, deleteDomain, createEmail, updateEmail, deleteEmail } from "../domain-actions";

export default async function AccessPage() {
  const { supabase } = await requireAdmin();
  const [domains, emails] = await Promise.all([
    fetchAll<Domain>(supabase, "allowed_signup_domains", "id, apex_domain, created_at, updated_at", "apex_domain"),
    fetchAll<AllowedEmail>(supabase, "whitelisted_emails", "id, email_address, created_at, updated_at", "email_address"),
  ]);

  return (
    <>
      <PageHeader
        title="Signup access"
        lede="Who is allowed to sign up: whole domains, plus individual e-mail addresses that are allowed even when their domain isn't."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Allowed signup domains" note={`${domains.length} domain${domains.length === 1 ? "" : "s"}. Use the apex domain, like columbia.edu.`}>
          <ActionForm action={createDomain} resetOnSuccess className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Field label="Add a domain">
                <input name="apex_domain" required maxLength={253} className="field" placeholder="barnard.edu" />
              </Field>
            </div>
            <SubmitButton pendingText="Adding…">Add domain</SubmitButton>
          </ActionForm>
          {domains.length === 0 ? (
            <Empty title="No domains yet" />
          ) : (
            <ul className="divide-y divide-line">
              {domains.map((d) => (
                <li key={d.id} className="py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="tnum text-[13px] text-muted">#{d.id}</span>
                    <span className="font-medium">{d.apex_domain}</span>
                    <span className="ml-auto text-[13px] text-muted">Added {fmtDate(d.created_at)}</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">Edit or delete</summary>
                    <ActionForm action={updateDomain} className="mt-3 flex flex-wrap items-end gap-3">
                      <input type="hidden" name="id" value={d.id} />
                      <div className="min-w-[200px] flex-1">
                        <Field label="Domain">
                          <input name="apex_domain" required maxLength={253} defaultValue={d.apex_domain} className="field" />
                        </Field>
                      </div>
                      <SubmitButton pendingText="Saving…">Save</SubmitButton>
                    </ActionForm>
                    <div className="mt-3">
                      <DeleteButton action={deleteDomain} id={d.id} label="Delete domain" confirmText={`Stop allowing signups from ${d.apex_domain}?`} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Whitelisted e-mail addresses" note={`${emails.length} address${emails.length === 1 ? "" : "es"}. Stored in lowercase.`}>
          <ActionForm action={createEmail} resetOnSuccess className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Field label="Add an e-mail address">
                <input name="email_address" type="email" required maxLength={254} className="field" placeholder="friend@gmail.com" />
              </Field>
            </div>
            <SubmitButton pendingText="Adding…">Add e-mail</SubmitButton>
          </ActionForm>
          {emails.length === 0 ? (
            <Empty title="No addresses yet" />
          ) : (
            <ul className="divide-y divide-line">
              {emails.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="tnum text-[13px] text-muted">#{e.id}</span>
                    <span className="break-all font-medium">{e.email_address}</span>
                    <span className="ml-auto text-[13px] text-muted">Added {fmtDate(e.created_at)}</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">Edit or delete</summary>
                    <ActionForm action={updateEmail} className="mt-3 flex flex-wrap items-end gap-3">
                      <input type="hidden" name="id" value={e.id} />
                      <div className="min-w-[200px] flex-1">
                        <Field label="E-mail address">
                          <input name="email_address" type="email" required maxLength={254} defaultValue={e.email_address} className="field" />
                        </Field>
                      </div>
                      <SubmitButton pendingText="Saving…">Save</SubmitButton>
                    </ActionForm>
                    <div className="mt-3">
                      <DeleteButton action={deleteEmail} id={e.id} label="Remove address" confirmText={`Remove ${e.email_address} from the whitelist?`} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
