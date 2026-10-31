import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireModule } from '@/lib/salon/context';
import { settings } from '@/lib/operations/shared';
import { SalonShell, PageHeading, Empty } from '@/components/salon/shell';
import { ActionForm, Field } from '@/components/salon/forms';
import { ModuleTabs, Panel } from '@/components/operations/ui';
import { updateSalon } from '@/server/salon-actions';
import { saveBusinessSettings } from '@/server/operations';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  const c = await requireModule('settings');
  if (!c.administrator || c.membership.branchScope !== 'all') {
    redirect('/salon/settings/profile');
  }

  const [salon, events] = await Promise.all([
    db.salon.findUniqueOrThrow({
      where: { id: c.salonId },
      select: { settings: true },
    }),
    db.auditEvent.findMany({
      where: { salonId: c.salonId },
      orderBy: { occurredAt: 'desc' },
      take: 40,
      select: { id: true, action: true, occurredAt: true },
    }),
  ]);

  const rules = settings(salon.settings);

  return (
    <SalonShell active="settings">
      <PageHeading
        eyebrow="BUSINESS PREFERENCES"
        title="Make yourself at home."
        description="Your salon identity, operating hours, booking rules and business preferences."
      />
      <ModuleTabs module="settings" />
      <div className="studio-content">
        <div className="overview-columns">
          <div>
            {/* Salon Identity */}
            <Panel title="Salon identity" description="Your business name displayed to customers and teammates across all locations.">
              <ActionForm action={updateSalon} submit="Save salon name">
                <Field name="name" label="Salon name" value={c.membership.salon.name} />
              </ActionForm>
            </Panel>

            {/* Booking & Financial Rules */}
            <Panel
              title="Booking & financial rules"
              description="Changes apply to new bookings and invoices. Existing prices and financial history remain preserved."
            >
              <ActionForm action={saveBusinessSettings} submit="Save business rules">
                <div className="form-grid">
                  <Field
                    name="openingHour"
                    label="Opening hour (IST, 0–23)"
                    type="number"
                    min={0}
                    max={23}
                    value={rules.openingHour}
                  />
                  <Field
                    name="closingHour"
                    label="Closing hour (IST, 1–24)"
                    type="number"
                    min={1}
                    max={24}
                    value={rules.closingHour}
                  />
                  <Field
                    name="taxPercent"
                    label="Tax rate (%)"
                    type="number"
                    min={0}
                    max={30}
                    value={rules.taxBps / 100}
                  />
                  <Field
                    name="discountPercent"
                    label="Operator discount limit (%)"
                    type="number"
                    min={0}
                    max={100}
                    value={rules.discountLimitBps / 100}
                  />
                  <Field
                    name="noShowLimit"
                    label="90-day no-show limit (0 disables)"
                    type="number"
                    min={0}
                    max={20}
                    value={rules.noShowLimit}
                  />
                  <Field
                    name="retentionDays"
                    label="Inactive after (days)"
                    type="number"
                    min={7}
                    max={365}
                    value={rules.retentionDays}
                  />
                  <Field
                    name="rebookingDays"
                    label="Rebooking interval (days)"
                    type="number"
                    min={1}
                    max={365}
                    value={rules.rebookingDays}
                  />
                </div>

                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label className="settings-check">
                    <input
                      type="checkbox"
                      name="automatedMessages"
                      defaultChecked={rules.automatedMessages}
                    />
                    Queue booking confirmations, 24-hour reminders and completed-visit feedback requests for customers who opted in. Delivery still requires approved provider templates and the scheduled worker.
                  </label>
                  <label className="settings-check">
                    <input
                      type="checkbox"
                      name="automaticStockUsage"
                      defaultChecked={rules.automaticStockUsage}
                    />
                    Deduct configured product quantities when new bookings are completed.
                  </label>
                  <label className="settings-check">
                    <input
                      type="checkbox"
                      name="requireShift"
                      defaultChecked={rules.requireShift}
                    />
                    Require new bookings to fit a planned staff shift.
                  </label>
                </div>
              </ActionForm>
            </Panel>
          </div>

          {/* Redesigned Scrollable Recent Activity Panel */}
          <section className="studio-panel settings-activity-panel">
            <div className="section-heading" style={{ marginBottom: '14px' }}>
              <div>
                <h2>Recent activity</h2>
                <p className="muted">Audit trail of operational events and security changes.</p>
              </div>
              <span className="billing-count">{events.length} events</span>
            </div>

            {events.length > 0 ? (
              <div className="activity-feed-scroll">
                {events.map(e => (
                  <div className="activity-item" key={e.id}>
                    <div className="activity-icon-dot" aria-hidden="true" />
                    <div className="activity-meta">
                      <span className="activity-action">
                        {e.action.replaceAll('.', ' · ').replaceAll('_', ' ')}
                      </span>
                      <time className="activity-date">
                        {new Date(e.occurredAt).toLocaleDateString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No recent activity logged"
                description="Salon events, appointment changes and audit actions will appear here."
              />
            )}
          </section>
        </div>
      </div>
    </SalonShell>
  );
}
