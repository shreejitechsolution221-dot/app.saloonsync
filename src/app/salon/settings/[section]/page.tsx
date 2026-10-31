import { CalendarSettings } from '@/components/operations/calendar-settings';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { requireModule } from '@/lib/salon/context';
import { SalonShell, PageHeading, Empty } from '@/components/salon/shell';
import { ActionForm, Field } from '@/components/salon/forms';
import { ModuleTabs, Panel, Select, Metric } from '@/components/operations/ui';
import {
  updateProfile,
  addLocation,
  updateLocation,
  addTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  selectLocation,
} from '@/server/operations';
import { SidePanel } from '@/components/salon/side-panel';

export const dynamic = 'force-dynamic';

export default async function SettingsSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!['profile', 'locations', 'tasks', 'integrations'].includes(section)) notFound();
  const c = await requireModule('settings');
  if (
    !['profile', 'integrations'].includes(section) &&
    (!c.administrator || c.membership.branchScope !== 'all')
  ) {
    redirect('/salon/access-denied');
  }

  const titles: Record<string, [string, string, string]> = {
    profile: [
      'PERSONAL PROFILE',
      'Your own little corner.',
      'Your account details, contact phone, and sign-in credentials.',
    ],
    locations: [
      'SALON LOCATIONS',
      'Every location, in sync.',
      'Manage branches and locations within this salon workspace.',
    ],
    tasks: [
      'DAILY CHECKLISTS',
      'A little structure goes a long way.',
      'Reusable opening, cleaning, equipment, and closing task templates.',
    ],
    integrations: [
      'CONNECTED SERVICES',
      'Connected, with care.',
      'Google Calendar synchronization, WhatsApp Cloud messaging, and private customer storage.',
    ],
  };

  let body: React.ReactNode;
  let actionButton: React.ReactNode = null;

  if (section === 'profile') {
    body = (
      <div className="overview-columns">
        <Panel title="Personal profile" description="Update your display name and contact phone number.">
          <ActionForm action={updateProfile} submit="Save my profile">
            <Field name="displayName" label="Full name" value={c.user.displayName} />
            <Field
              name="mobileNumber"
              label="Phone number"
              type="tel"
              value={c.user.mobileNumber ?? ''}
              required={false}
            />
            <label className="field">
              Sign-in email
              <input value={c.user.email} readOnly />
            </label>
          </ActionForm>
        </Panel>

        <Panel title="Account security" description="Manage password recovery and workspace identity.">
          <p className="muted">
            Email and password changes use the verified sign-in recovery flow sent to your registered address.
          </p>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link className="secondary" href="/auth/forgot-password?portal=salon" style={{ display: 'inline-block', textAlign: 'center' }}>
              Reset my password ↗
            </Link>
            <p className="hint">
              Your personal profile changes do not change your salon permissions, assigned role, or location scope.
            </p>
          </div>
        </Panel>
      </div>
    );
  } else if (section === 'locations') {
    const locations = await db.branch.findMany({
      where: { salonId: c.salonId },
      orderBy: { name: 'asc' },
    });

    const activeCount = locations.filter(b => b.status === 'active').length;

    actionButton = (
      <SidePanel
        id="add-location"
        label="+ Add a location"
        title="Add a location"
        description="Add a new physical branch location for this salon."
        eyebrow="LOCATION SETUP"
      >
        <ActionForm action={addLocation} submit="Add location">
          <Field name="name" label="Location name" />
          <label className="field">
            Address
            <textarea name="address" required maxLength={500} placeholder="Full address, city, and pincode..." />
          </label>
          <Field name="phone" label="Location phone" type="tel" required={false} />
        </ActionForm>
      </SidePanel>
    );

    body = (
      <>
        <div className="metric-grid">
          <Metric label="Total locations" value={locations.length} note="Configured branches" />
          <Metric label="Active locations" value={activeCount} note="Open for booking and POS" />
          <Metric label="Current branch" value={c.branches.length === 1 ? c.branches[0].name : 'All locations'} note="Your selected filter" />
          <Metric label="Operational status" value="Active" note="Salon network ready" />
        </div>

        <section className="studio-panel">
          <div className="section-heading">
            <div>
              <h2>Your locations</h2>
              <p className="muted">All physical branches associated with {c.membership.salon.name}.</p>
            </div>
            <span className="billing-count">{locations.length} locations</span>
          </div>

          {locations.length > 0 ? (
            <div className="locations-grid">
              {locations.map(b => (
                <article className="location-card" key={b.id}>
                  <div className="location-card-header">
                    <div>
                      <h3 className="location-card-title">{b.name}</h3>
                      <span className={`state-pill ${b.status}`} style={{ marginTop: '4px' }}>
                        {b.status}
                      </span>
                    </div>
                  </div>

                  <div className="location-card-details">
                    <div className="location-detail-row">
                      <span aria-hidden="true">📍</span>
                      <span>{b.address || 'Address not added'}</span>
                    </div>
                    <div className="location-detail-row">
                      <span aria-hidden="true">📞</span>
                      <span>{b.phone || 'No phone number configured'}</span>
                    </div>
                  </div>

                  <div className="card-action-bar">
                    {/* View Location */}
                    <SidePanel
                      secondary
                      label="View"
                      title={b.name}
                      description="Location profile details"
                      eyebrow="BRANCH OVERVIEW"
                    >
                      <div className="view-details-panel">
                        <dl className="details-grid">
                          <div>
                            <dt>Location name</dt>
                            <dd>
                              <strong>{b.name}</strong>
                            </dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>
                              <span className={`state-pill ${b.status}`}>{b.status}</span>
                            </dd>
                          </div>
                          <div>
                            <dt>Contact phone</dt>
                            <dd>{b.phone || 'None'}</dd>
                          </div>
                          <div>
                            <dt>Added on</dt>
                            <dd>
                              {new Date(b.createdAt).toLocaleDateString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </dd>
                          </div>
                        </dl>
                        <div className="message-preview-box">
                          <span className="field-label">Full Address:</span>
                          <p className="message-full-text">{b.address || 'No physical address specified'}</p>
                        </div>
                      </div>
                    </SidePanel>

                    {/* Update Location */}
                    <SidePanel
                      secondary
                      label="Update"
                      title={`Update ${b.name}`}
                      description="Edit location name, address, phone number or status."
                      eyebrow="UPDATE LOCATION"
                    >
                      <ActionForm action={updateLocation} submit="Save location">
                        <input type="hidden" name="id" value={b.id} />
                        <Field name="name" label="Location name" value={b.name} />
                        <label className="field">
                          Address
                          <textarea name="address" defaultValue={b.address} required maxLength={500} />
                        </label>
                        <Field name="phone" label="Location phone" type="tel" value={b.phone} required={false} />
                        <label className="field">
                          Status
                          <select name="status" defaultValue={b.status}>
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                          </select>
                        </label>
                      </ActionForm>
                    </SidePanel>

                    {/* Manage Location */}
                    <SidePanel
                      secondary
                      label="Manage"
                      title={`Manage: ${b.name}`}
                      description="Quickly switch into this location or manage its operating scope."
                      eyebrow="LOCATION WORKSPACE"
                    >
                      <div className="view-details-panel">
                        <p>
                          Switch your workspace focus directly into <strong>{b.name}</strong> to view its localized calendar, appointments, daily registers, and stock.
                        </p>
                        <form action={selectLocation}>
                          <input type="hidden" name="location" value={b.id} />
                          <button type="submit" className="primary" style={{ width: '100%' }}>
                            Switch active workspace to {b.name} ↗
                          </button>
                        </form>
                      </div>
                    </SidePanel>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No locations configured"
              description="Add your first physical branch using '+ Add a location' above."
            />
          )}
        </section>
      </>
    );
  } else if (section === 'tasks') {
    const tasks = await db.taskTemplate.findMany({
      where: { salonId: c.salonId, active: true },
      orderBy: { category: 'asc' },
      take: 100,
    });

    const openingCount = tasks.filter(t => t.category === 'opening').length;
    const cleaningCount = tasks.filter(t => t.category === 'cleaning').length;
    const equipmentCount = tasks.filter(t => t.category === 'equipment').length;
    const closingCount = tasks.filter(t => t.category === 'closing').length;

    actionButton = (
      <SidePanel
        id="create-task"
        label="+ Create a task template"
        title="Create a task template"
        description="Add a reusable daily opening, cleaning, equipment, or closing checklist task."
        eyebrow="DAILY TASKS"
      >
        <ActionForm action={addTaskTemplate} submit="Add task">
          <Field name="title" label="Task title" />
          <Select
            name="category"
            label="Category"
            options={['opening', 'cleaning', 'equipment', 'closing'].map(id => ({
              id,
              name: id.charAt(0).toUpperCase() + id.slice(1),
            }))}
          />
        </ActionForm>
      </SidePanel>
    );

    body = (
      <>
        <div className="metric-grid">
          <Metric label="Total task templates" value={tasks.length} note="Reusable daily checklists" />
          <Metric label="Opening checklist" value={openingCount} note="Morning readiness tasks" />
          <Metric label="Cleaning & hygiene" value={cleaningCount} note="Station & sanitization" />
          <Metric label="Equipment & closing" value={equipmentCount + closingCount} note="Operational sign-offs" />
        </div>

        <section className="studio-panel">
          <div className="section-heading">
            <div>
              <h2>Daily task templates</h2>
              <p className="muted">Configured operational checklist items assigned across all locations.</p>
            </div>
            <span className="billing-count">{tasks.length} templates</span>
          </div>

          {tasks.length > 0 ? (
            <div className="tasks-grid">
              {tasks.map(t => (
                <article className="task-template-card" key={t.id}>
                  <div className="task-template-header">
                    <span className={`category-badge category-${t.category}`}>{t.category}</span>
                  </div>

                  <h3 className="task-template-title">{t.title}</h3>

                  <div className="card-action-bar">
                    {/* View Task */}
                    <SidePanel
                      secondary
                      label="View"
                      title={t.title}
                      description={`Category: ${t.category}`}
                      eyebrow="TASK CHECKLIST"
                    >
                      <div className="view-details-panel">
                        <dl className="details-grid">
                          <div>
                            <dt>Task Title</dt>
                            <dd>
                              <strong>{t.title}</strong>
                            </dd>
                          </div>
                          <div>
                            <dt>Category</dt>
                            <dd>
                              <span className={`category-badge category-${t.category}`}>{t.category}</span>
                            </dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>
                              <span className="state-pill active">Active</span>
                            </dd>
                          </div>
                          <div>
                            <dt>Schedule</dt>
                            <dd>Daily checklist</dd>
                          </div>
                        </dl>
                      </div>
                    </SidePanel>

                    {/* Edit Task */}
                    <SidePanel
                      secondary
                      label="Edit"
                      title="Edit task template"
                      description="Update task title or category."
                      eyebrow="UPDATE TASK"
                    >
                      <ActionForm action={updateTaskTemplate} submit="Save task">
                        <input type="hidden" name="id" value={t.id} />
                        <Field name="title" label="Task title" value={t.title} />
                        <Select
                          name="category"
                          label="Category"
                          value={t.category}
                          options={['opening', 'cleaning', 'equipment', 'closing'].map(id => ({
                            id,
                            name: id.charAt(0).toUpperCase() + id.slice(1),
                          }))}
                        />
                        <label className="settings-check">
                          <input type="checkbox" name="active" defaultChecked={t.active} />
                          Task active in daily checklist
                        </label>
                      </ActionForm>
                    </SidePanel>

                    {/* Delete Task */}
                    <SidePanel
                      secondary
                      label="Delete"
                      title="Delete task template"
                      description="Remove this template from daily checklists."
                      eyebrow="CONFIRM DELETION"
                    >
                      <div className="confirm-delete-box">
                        <p>
                          Are you sure you want to delete task template <strong>{t.title}</strong>?
                        </p>
                        <p className="muted">
                          This template will be removed from future daily checklists.
                        </p>
                        <ActionForm action={deleteTaskTemplate} submit="Confirm delete">
                          <input type="hidden" name="id" value={t.id} />
                        </ActionForm>
                      </div>
                    </SidePanel>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No task templates created"
              description="Create reusable opening, cleaning, or closing checklists with '+ Create a task template' above."
            />
          )}
        </section>
      </>
    );
  } else {
    const jobs =
      c.administrator && c.membership.branchScope === 'all'
        ? await db.messageJob.findMany({
            where: { salonId: c.salonId },
            orderBy: { createdAt: 'desc' },
            take: 30,
            select: { id: true, kind: true, status: true, attempts: true, lastError: true },
          })
        : [];

    body = (
      <>
        <CalendarSettings />

        <div className="overview-columns">
          <Panel title="WhatsApp Cloud templates">
            <span className="state-pill">
              {process.env.TWILIO_ACCOUNT_SID &&
              process.env.TWILIO_AUTH_TOKEN &&
              process.env.TWILIO_WHATSAPP_FROM
                ? 'Credentials configured'
                : 'Configuration required'}
            </span>
            <p className="muted" style={{ marginTop: '10px' }}>
              Approved templates, customer opt-in and a scheduled delivery worker are required. Credentials belong in server environment variables.
            </p>
            <p className="hint">No WhatsApp messages are sent merely by opening this page.</p>
          </Panel>

          <Panel title="Private customer portfolio">
            <span className="state-pill">
              {process.env.SUPABASE_SERVICE_ROLE_KEY &&
              process.env.SUPABASE_PORTFOLIO_BUCKET
                ? 'Storage configuration present'
                : 'Configuration required'}
            </span>
            <p className="muted" style={{ marginTop: '10px' }}>
              Uses a private bucket, verified consent, stripped image metadata and short-lived viewing links. The bucket must be provisioned before uploading.
            </p>
          </Panel>
        </div>

        <section className="studio-panel">
          <div className="section-heading">
            <div>
              <h2>Delivery queue</h2>
              <p className="muted">Background messaging and synchronization jobs status.</p>
            </div>
            <span className="billing-count">{jobs.length} jobs</span>
          </div>

          {jobs.length > 0 ? (
            <div>
              {jobs.map(j => (
                <div className="visit-row" key={j.id}>
                  <span>
                    <strong>{j.kind}</strong>
                    <small>
                      {j.attempts} attempts · {j.lastError ?? 'No delivery error'}
                    </small>
                  </span>
                  <span className="state-pill">{j.status.replaceAll('_', ' ')}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No messages queued" description="Delivery queue is clear. No pending background tasks." />
          )}
        </section>
      </>
    );
  }

  return (
    <SalonShell active="settings">
      <PageHeading
        eyebrow={titles[section][0]}
        title={titles[section][1]}
        description={titles[section][2]}
        action={actionButton}
      />
      <ModuleTabs
        module="settings"
        active={'/' + section}
        allowed={c.administrator ? undefined : ['/profile', '/integrations']}
      />
      <div className="studio-content">{body}</div>
    </SalonShell>
  );
}
