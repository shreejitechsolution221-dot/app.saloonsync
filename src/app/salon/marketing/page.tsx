import { db } from '@/lib/db';
import { requireOperations } from '@/lib/salon/context';
import { SalonShell, PageHeading, Empty } from '@/components/salon/shell';
import { ActionForm, Field } from '@/components/salon/forms';
import { ModuleTabs, Select, Metric } from '@/components/operations/ui';
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
  queueCustomerMessage,
} from '@/server/growth-inventory';
import { SidePanel } from '@/components/salon/side-panel';

export const dynamic = 'force-dynamic';

export default async function Marketing() {
  const c = await requireOperations(true, 'marketing');
  const [campaigns, customers] = await Promise.all([
    db.campaign.findMany({
      where: { salonId: c.salonId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.salonCustomer.findMany({
      where: { salonId: c.salonId },
      select: {
        id: true,
        displayName: true,
        phone: true,
        whatsappConsentAt: true,
        marketingConsentAt: true,
      },
      orderBy: { displayName: 'asc' },
      take: 500,
    }),
  ]);

  const consentingCount = customers.filter(
    cust => cust.whatsappConsentAt && cust.marketingConsentAt && cust.phone,
  ).length;
  const uniqueAudiences = new Set(campaigns.map(x => x.kind)).size;

  const customerOptions = customers.map(cust => {
    const hasPhone = Boolean(cust.phone);
    const hasConsent = Boolean(cust.whatsappConsentAt && cust.marketingConsentAt);
    const label = `${cust.displayName}${cust.phone ? ` • ${cust.phone}` : ''}${
      !hasPhone ? ' (No phone)' : hasConsent ? ' ✓ Opted in' : ' (Consent required)'
    }`;
    return {
      id: cust.id,
      name: label,
    };
  });

  return (
    <SalonShell active="marketing">
      <PageHeading
        eyebrow="WHATSAPP & PROMOTIONS"
        title="Stay a little closer."
        description="Thoughtful campaigns, explicit consent and approved WhatsApp templates."
        action={
          <SidePanel
            id="create-campaign"
            label="+ Create campaign draft"
            title="Create a campaign draft"
            description="Draft promotional, celebration, or re-engagement messages for consenting clients."
            eyebrow="WHATSAPP & CAMPAIGNS"
          >
            <ActionForm action={createCampaign} submit="Save draft">
              <Field name="title" label="Campaign title" />
              <Select
                name="kind"
                label="Audience purpose"
                options={[
                  { id: 'birthday', name: 'birthday' },
                  { id: 'inactive', name: 'inactive' },
                  { id: 'frequent', name: 'frequent' },
                  { id: 'general', name: 'general' },
                ]}
              />
              <label className="field">
                Message detail
                <textarea
                  name="message"
                  required
                  maxLength={1000}
                />
              </label>
            </ActionForm>
            <p className="availability-note" style={{ marginTop: '12px' }}>
              Saving a draft does not send a message. Delivery needs a configured WhatsApp sender, approved templates and the secured delivery worker. The final message follows the provider template.
            </p>
          </SidePanel>
        }
      />
      <ModuleTabs module="marketing" />
      <div className="studio-content">
        <div className="metric-grid">
          <Metric label="Campaign drafts" value={campaigns.length} note="Ready for audience queue" />
          <Metric
            label="Total customers"
            value={customers.length}
            note={`${consentingCount} WhatsApp opted-in`}
          />
          <Metric label="Audience purposes" value={uniqueAudiences || 4} note="Birthday, Inactive, VIP & General" />
          <Metric label="Delivery channel" value="WhatsApp Cloud" note="Secured background queue" />
        </div>

        <section className="studio-panel marketing-panel">
          <div className="section-heading">
            <div>
              <h2>Campaign message drafts</h2>
              <p className="muted">
                Approved template drafts for targeted messaging. Queue for any verified consenting customer.
              </p>
            </div>
            <span className="billing-count">{campaigns.length} drafts</span>
          </div>

          {campaigns.length > 0 ? (
            <div className="marketing-campaign-grid">
              {campaigns.map(x => (
                <article className="marketing-campaign-card" key={x.id}>
                  <div className="marketing-card-header">
                    <div>
                      <span className="state-pill">{x.kind}</span>
                      <h3>{x.title}</h3>
                    </div>
                  </div>
                  <div className="marketing-card-message">
                    <p>{x.message}</p>
                  </div>

                  <div className="card-action-bar">
                    {/* View Option */}
                    <SidePanel
                      secondary
                      label="View"
                      title={x.title}
                      description={`Audience: ${x.kind}`}
                      eyebrow="CAMPAIGN PREVIEW"
                    >
                      <div className="view-details-panel">
                        <dl className="details-grid">
                          <div>
                            <dt>Campaign Title</dt>
                            <dd>
                              <strong>{x.title}</strong>
                            </dd>
                          </div>
                          <div>
                            <dt>Audience Purpose</dt>
                            <dd>
                              <span className="state-pill">{x.kind}</span>
                            </dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>
                              <span className="state-pill">{x.status}</span>
                            </dd>
                          </div>
                          <div>
                            <dt>Created Date</dt>
                            <dd>
                              {new Date(x.createdAt).toLocaleDateString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </dd>
                          </div>
                        </dl>
                        <div className="message-preview-box">
                          <span className="field-label">Message Content:</span>
                          <p className="message-full-text">{x.message}</p>
                        </div>
                      </div>
                    </SidePanel>

                    {/* Edit Option */}
                    <SidePanel
                      secondary
                      label="Edit"
                      title="Edit campaign draft"
                      description="Update campaign title, audience purpose, or message text."
                      eyebrow="UPDATE CAMPAIGN"
                    >
                      <ActionForm action={updateCampaign} submit="Save changes">
                        <input type="hidden" name="id" value={x.id} />
                        <Field name="title" label="Campaign title" value={x.title} />
                        <Select
                          name="kind"
                          label="Audience purpose"
                          value={x.kind}
                          options={[
                            { id: 'birthday', name: 'birthday' },
                            { id: 'inactive', name: 'inactive' },
                            { id: 'frequent', name: 'frequent' },
                            { id: 'general', name: 'general' },
                          ]}
                        />
                        <label className="field">
                          Message detail
                          <textarea
                            name="message"
                            defaultValue={x.message}
                            required
                            maxLength={1000}
                          />
                        </label>
                      </ActionForm>
                    </SidePanel>

                    {/* Delete Option */}
                    <SidePanel
                      secondary
                      label="Delete"
                      title="Delete campaign draft"
                      description="Permanently remove this campaign draft."
                      eyebrow="CONFIRM DELETION"
                    >
                      <div className="confirm-delete-box">
                        <p>
                          Are you sure you want to delete campaign <strong>{x.title}</strong>?
                        </p>
                        <p className="muted">
                          Any queued delivery jobs for this campaign will also be cleared. This cannot be undone.
                        </p>
                        <ActionForm action={deleteCampaign} submit="Confirm delete">
                          <input type="hidden" name="id" value={x.id} />
                        </ActionForm>
                      </div>
                    </SidePanel>
                  </div>

                  <div className="marketing-card-footer">
                    <details className="marketing-dispatch-drawer">
                      <summary>Queue for a customer ({customers.length} available)</summary>
                      <div className="dispatch-form-body">
                        <ActionForm action={queueCustomerMessage} submit="Queue campaign message">
                          <input type="hidden" name="campaignId" value={x.id} />
                          <input type="hidden" name="kind" value="campaign" />
                          <Select
                            name="customerId"
                            label="Select customer"
                            options={customerOptions}
                          />
                          <label className="settings-check">
                            <input type="checkbox" name="attestConsent" defaultChecked />
                            Record verified WhatsApp & marketing consent if not already on file
                          </label>
                          <label className="settings-check">
                            <input type="checkbox" name="confirm" required />
                            Queue this approved-template message for the selected customer.
                          </label>
                        </ActionForm>
                      </div>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No campaign drafts created yet"
              description="Click '+ Create campaign draft' above to draft your first promotional or birthday message."
            />
          )}
        </section>
      </div>
    </SalonShell>
  );
}
