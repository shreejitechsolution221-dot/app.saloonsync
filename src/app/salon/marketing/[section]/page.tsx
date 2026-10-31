import { OfferForm } from '@/components/operations/offer-form';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireOperations, money } from '@/lib/salon/context';
import { SalonShell, PageHeading, Empty } from '@/components/salon/shell';
import { ActionForm, Field } from '@/components/salon/forms';
import { ModuleTabs, Panel, Metric } from '@/components/operations/ui';
import {
  issueGiftCard,
  updateGiftCard,
  deleteGiftCard,
  updateOffer,
  deleteOffer,
} from '@/server/growth-inventory';
import { SidePanel } from '@/components/salon/side-panel';

export const dynamic = 'force-dynamic';

export default async function GrowthSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!['offers', 'feedback'].includes(section)) notFound();
  const c = await requireOperations(true, 'marketing');

  let body: React.ReactNode;
  let actionButtons: React.ReactNode = null;

  if (section === 'offers') {
    const [offers, cards] = await Promise.all([
      db.offer.findMany({
        where: { salonId: c.salonId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.giftCard.findMany({
        where: { salonId: c.salonId },
        select: {
          id: true,
          lastFour: true,
          initialPaise: true,
          balancePaise: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const activeOffers = offers.filter(
      o => o.active && new Date(o.expiresAt) > new Date(),
    ).length;
    const totalCardBalance = cards.reduce((sum, g) => sum + g.balancePaise, 0);
    const totalRedeemed = cards.reduce((sum, g) => sum + (g.initialPaise - g.balancePaise), 0);

    actionButtons = (
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <SidePanel
          id="create-offer"
          label="+ Create an offer"
          title="Create an offer"
          description="Configure percentage or fixed amount discounts."
          eyebrow="OFFERS & COUPONS"
        >
          <OfferForm />
        </SidePanel>
        <SidePanel
          id="issue-gift-card"
          secondary
          label="+ Issue a gift card"
          title="Issue a gift card"
          description="Generate a digital stored-value card for a customer."
          eyebrow="STORED VALUE"
        >
          <ActionForm action={issueGiftCard} submit="Issue gift card">
            <Field name="amountRupees" label="Initial value (INR)" type="number" min={0.01} />
            <Field name="expiresOn" label="Expires on" type="date" />
          </ActionForm>
          <p className="hint" style={{ marginTop: '12px' }}>
            The redemption code is shown only once; only its hash is stored. This issues a stored-value record, not an online charge. Record any upfront collection according to your finance process.
          </p>
        </SidePanel>
      </div>
    );

    body = (
      <>
        <div className="metric-grid">
          <Metric label="Active offers" value={activeOffers} note={`${offers.length} total created`} />
          <Metric label="Gift cards issued" value={cards.length} note="Digital stored value" />
          <Metric label="Outstanding balance" value={money(totalCardBalance)} note="Unredeemed credit" />
          <Metric label="Redeemed value" value={money(totalRedeemed)} note="Total credit utilized" />
        </div>

        <div className="overview-columns">
          <Panel title="Offers & coupons" description="Active and historical discount codes applied at billing.">
            {offers.length > 0 ? (
              offers.map(o => {
                const isExpired = new Date(o.expiresAt) <= new Date();
                return (
                  <div className="visit-row" key={o.id}>
                    <span style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <strong>{o.name}</strong>
                        <span className="code-pill">{o.code}</span>
                      </div>
                      <small>
                        {isExpired ? 'Expired' : 'Expires'}{' '}
                        {o.expiresAt.toLocaleDateString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </small>
                    </span>

                    <div style={{ textAlign: 'right', marginRight: '12px' }}>
                      <span className="offer-val-badge">
                        {o.kind === 'fixed' ? money(o.value) : `${o.value / 100}%`}
                      </span>
                      <small
                        style={{
                          display: 'block',
                          color: !o.active ? '#8c818e' : isExpired ? '#c62828' : '#2e7d32',
                          fontWeight: 600,
                        }}
                      >
                        {!o.active ? 'Disabled' : isExpired ? 'Expired' : 'Active'}
                      </small>
                    </div>

                    <div className="row-action-bar">
                      {/* View Offer */}
                      <SidePanel
                        secondary
                        label="View"
                        title={o.name}
                        description={`Coupon code: ${o.code}`}
                        eyebrow="OFFER DETAILS"
                      >
                        <div className="view-details-panel">
                          <dl className="details-grid">
                            <div>
                              <dt>Coupon Code</dt>
                              <dd>
                                <span className="code-pill">{o.code}</span>
                              </dd>
                            </div>
                            <div>
                              <dt>Offer Name</dt>
                              <dd>
                                <strong>{o.name}</strong>
                              </dd>
                            </div>
                            <div>
                              <dt>Discount Type</dt>
                              <dd>
                                {o.kind === 'fixed' ? 'Fixed amount discount' : 'Percentage discount'}
                              </dd>
                            </div>
                            <div>
                              <dt>Discount Value</dt>
                              <dd>
                                <strong>{o.kind === 'fixed' ? money(o.value) : `${o.value / 100}% OFF`}</strong>
                              </dd>
                            </div>
                            <div>
                              <dt>Active Status</dt>
                              <dd>{o.active ? 'Active' : 'Disabled'}</dd>
                            </div>
                            <div>
                              <dt>Expires On</dt>
                              <dd>
                                {o.expiresAt.toLocaleDateString('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </SidePanel>

                      {/* Edit Offer */}
                      <SidePanel
                        secondary
                        label="Edit"
                        title="Edit offer"
                        description={`Update discount details for ${o.code}`}
                        eyebrow="OFFERS & COUPONS"
                      >
                        <ActionForm action={updateOffer} submit="Save offer">
                          <input type="hidden" name="id" value={o.id} />
                          <Field name="name" label="Offer name" value={o.name} />
                          <input type="hidden" name="kind" value={o.kind} />
                          {o.kind === 'fixed' ? (
                            <Field
                              name="valueRupees"
                              label="Discount amount (INR)"
                              type="number"
                              min={0.01}
                              value={o.value / 100}
                            />
                          ) : (
                            <Field
                              name="offerPercent"
                              label="Discount (%)"
                              type="number"
                              min={0.01}
                              max={100}
                              value={o.value / 100}
                            />
                          )}
                          <Field
                            name="expiresOn"
                            label="Expires on"
                            type="date"
                            value={new Date(o.expiresAt).toISOString().slice(0, 10)}
                          />
                          <label className="settings-check">
                            <input type="checkbox" name="active" defaultChecked={o.active} />
                            Offer active and redeemable at checkout
                          </label>
                        </ActionForm>
                      </SidePanel>

                      {/* Delete Offer */}
                      <SidePanel
                        secondary
                        label="Delete"
                        title="Delete offer"
                        description="Permanently remove this coupon offer."
                        eyebrow="DELETE OFFER"
                      >
                        <div className="confirm-delete-box">
                          <p>
                            Are you sure you want to delete offer <strong>{o.name}</strong> (
                            <span className="code-pill">{o.code}</span>)?
                          </p>
                          <p className="muted">
                            This promo discount will no longer be available to apply during checkout.
                          </p>
                          <ActionForm action={deleteOffer} submit="Confirm delete">
                            <input type="hidden" name="id" value={o.id} />
                          </ActionForm>
                        </div>
                      </SidePanel>
                    </div>
                  </div>
                );
              })
            ) : (
              <Empty
                title="No offers created yet"
                description="Create promo codes or discounts using '+ Create an offer' above."
              />
            )}
          </Panel>

          <Panel title="Gift card balances" description="Customer stored-value prepaid cards and remaining funds.">
            {cards.length > 0 ? (
              cards.map(g => {
                const isExpired = new Date(g.expiresAt) <= new Date();
                const isDepleted = g.balancePaise === 0;
                return (
                  <div className="gift-card-row" key={g.id}>
                    <div className="gift-card-visual">
                      <div className="gift-card-icon">CARD</div>
                      <div className="gift-card-meta">
                        <strong>•••• {g.lastFour}</strong>
                        <small>
                          {isExpired ? 'Expired' : 'Expires'}{' '}
                          {g.expiresAt.toLocaleDateString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </small>
                      </div>
                    </div>
                    <div className="gift-card-balance-block" style={{ marginRight: '12px' }}>
                      <strong>{money(g.balancePaise)}</strong>
                      <small>of {money(g.initialPaise)}</small>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '9px',
                          fontWeight: 600,
                          marginTop: '2px',
                          color: isDepleted ? '#8c818e' : isExpired ? '#c62828' : '#2e7d32',
                        }}
                      >
                        {isDepleted ? 'Depleted' : isExpired ? 'Expired' : 'Active'}
                      </span>
                    </div>

                    <div className="row-action-bar">
                      {/* View Gift Card */}
                      <SidePanel
                        secondary
                        label="View"
                        title={`Gift Card •••• ${g.lastFour}`}
                        description="Prepaid stored-value card"
                        eyebrow="CARD OVERVIEW"
                      >
                        <div className="view-details-panel">
                          <dl className="details-grid">
                            <div>
                              <dt>Card Number</dt>
                              <dd>•••• •••• •••• {g.lastFour}</dd>
                            </div>
                            <div>
                              <dt>Initial Stored Value</dt>
                              <dd>
                                <strong>{money(g.initialPaise)}</strong>
                              </dd>
                            </div>
                            <div>
                              <dt>Remaining Balance</dt>
                              <dd>
                                <strong>{money(g.balancePaise)}</strong>
                              </dd>
                            </div>
                            <div>
                              <dt>Redeemed Total</dt>
                              <dd>{money(g.initialPaise - g.balancePaise)}</dd>
                            </div>
                            <div>
                              <dt>Expiration Date</dt>
                              <dd>
                                {g.expiresAt.toLocaleDateString('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </dd>
                            </div>
                            <div>
                              <dt>Issued Date</dt>
                              <dd>
                                {new Date(g.createdAt).toLocaleDateString('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </SidePanel>

                      {/* Edit Gift Card */}
                      <SidePanel
                        secondary
                        label="Edit"
                        title={`Edit card •••• ${g.lastFour}`}
                        description="Update remaining balance or extend expiry date."
                        eyebrow="GIFT CARDS"
                      >
                        <ActionForm action={updateGiftCard} submit="Save card">
                          <input type="hidden" name="id" value={g.id} />
                          <Field
                            name="balanceRupees"
                            label="Current balance (INR)"
                            type="number"
                            min={0}
                            value={g.balancePaise / 100}
                          />
                          <Field
                            name="expiresOn"
                            label="Expires on"
                            type="date"
                            value={new Date(g.expiresAt).toISOString().slice(0, 10)}
                          />
                        </ActionForm>
                      </SidePanel>

                      {/* Delete Gift Card */}
                      <SidePanel
                        secondary
                        label="Delete"
                        title={`Delete card •••• ${g.lastFour}`}
                        description="Cancel and remove this stored-value card."
                        eyebrow="DELETE GIFT CARD"
                      >
                        <div className="confirm-delete-box">
                          <p>
                            Are you sure you want to cancel and delete gift card <strong>•••• {g.lastFour}</strong>?
                          </p>
                          <p className="muted">
                            The remaining balance of <strong>{money(g.balancePaise)}</strong> will be voided.
                          </p>
                          <ActionForm action={deleteGiftCard} submit="Confirm delete">
                            <input type="hidden" name="id" value={g.id} />
                          </ActionForm>
                        </div>
                      </SidePanel>
                    </div>
                  </div>
                );
              })
            ) : (
              <Empty
                title="No gift cards issued yet"
                description="Issue digital stored-value cards using '+ Issue a gift card' above."
              />
            )}
          </Panel>
        </div>
      </>
    );
  } else {
    const feedback = await db.$queryRaw<
      { id: string; rating: number; comment: string; serviceName: string; createdAt: Date }[]
    >`SELECT f.id,f.rating,f.comment,f."createdAt",a."serviceName" FROM app."Feedback" f JOIN app."Appointment" a ON a.id=f."appointmentId" AND a."salonId"=f."salonId" WHERE f."salonId"=${c.salonId}::uuid AND a."branchId"=ANY(${c.branches.map(b => b.id)}::uuid[]) ORDER BY f."createdAt" DESC LIMIT 100`;

    const totalReviews = feedback.length;
    const avgRating = totalReviews
      ? (feedback.reduce((sum, f) => sum + f.rating, 0) / totalReviews).toFixed(1)
      : '5.0';
    const fiveStarCount = feedback.filter(f => f.rating === 5).length;
    const positiveRate = totalReviews
      ? Math.round((feedback.filter(f => f.rating >= 4).length / totalReviews) * 100)
      : 100;

    body = (
      <>
        <div className="metric-grid">
          <Metric
            label="Average rating"
            value={`★ ${avgRating} / 5.0`}
            note={totalReviews ? `Based on ${totalReviews} verified reviews` : 'Awaiting completed reviews'}
          />
          <Metric
            label="5-Star reviews"
            value={fiveStarCount}
            note={totalReviews ? `${Math.round((fiveStarCount / totalReviews) * 100)}% of total ratings` : 'Top ratings'}
          />
          <Metric
            label="Positive sentiment"
            value={`${positiveRate}%`}
            note="Rated 4 or 5 stars"
          />
          <Metric
            label="Verified visits"
            value="100% Verified"
            note="Recorded directly after completed service"
          />
        </div>

        <section className="studio-panel">
          <div className="section-heading">
            <div>
              <h2>Customer feedback</h2>
              <p className="muted">
                Only verified customers can rate their own completed visits. Salon staff cannot create ratings on a customer&apos;s behalf.
              </p>
            </div>
            <span className="billing-count">{feedback.length} reviews</span>
          </div>

          {feedback.length > 0 ? (
            <div className="feedback-cards-grid">
              {feedback.map(f => (
                <article className="feedback-card" key={f.id}>
                  <div className="feedback-card-top">
                    <div className="feedback-service">
                      <strong>{f.serviceName}</strong>
                      <span className="feedback-verified-pill">✓ Verified visit</span>
                    </div>
                    <div className="feedback-stars" aria-label={`${f.rating} out of 5 stars`}>
                      <span className="stars-gold">{'★'.repeat(f.rating)}</span>
                      <span className="stars-muted">{'☆'.repeat(5 - f.rating)}</span>
                      <span className="stars-num">{f.rating}.0</span>
                    </div>
                  </div>
                  <div className="feedback-card-body">
                    <p>
                      {f.comment ? (
                        `“${f.comment}”`
                      ) : (
                        <em className="muted">No written comment</em>
                      )}
                    </p>
                  </div>
                  <div className="feedback-card-footer">
                    <time>
                      {new Date(f.createdAt).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No customer feedback recorded yet"
              description="Customer reviews appear here automatically when clients submit their feedback after completed visits."
            />
          )}
        </section>
      </>
    );
  }

  return (
    <SalonShell active="marketing">
      <PageHeading
        eyebrow={section === 'offers' ? 'GROWTH & REWARDS' : 'CUSTOMER EXPERIENCE'}
        title={
          section === 'offers'
            ? 'A little something to look forward to.'
            : 'Listen. Learn. Care a little more.'
        }
        description={
          section === 'offers'
            ? 'Offers, gift cards and the details that bring people back.'
            : 'Verified feedback from completed salon visits.'
        }
        action={actionButtons}
      />
      <ModuleTabs module="marketing" active={'/' + section} />
      <div className="studio-content">{body}</div>
    </SalonShell>
  );
}
