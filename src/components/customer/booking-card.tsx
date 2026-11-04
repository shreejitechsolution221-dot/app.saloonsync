'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CustomerIcon } from './icons';
import { cancelCustomerAppointment, rescheduleCustomerAppointment, submitCustomerFeedback } from '@/server/customer-booking-actions';
import type { CustomerBookingItem } from '@/lib/customer/types';

export function BookingCard({
  booking,
  isUpcoming = false,
}: {
  booking: CustomerBookingItem;
  isUpcoming?: boolean;
}) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [newDateStr, setNewDateStr] = useState('');
  const [newTimeStr, setNewTimeStr] = useState('11:00');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const startsAtDate = new Date(booking.startsAt);
  const formattedDate = startsAtDate.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const referenceCode = booking.recurrenceKey || `GD-${booking.id.slice(0, 8).toUpperCase()}`;

  const statusMap: Record<CustomerBookingItem['status'], { label: string; badgeClass: string; step: number }> = {
    pending: { label: 'Pending Approval', badgeClass: 'status-pending', step: 1 },
    confirmed: { label: 'Confirmed', badgeClass: 'status-confirmed', step: 2 },
    checked_in: { label: 'Checked In', badgeClass: 'status-checked-in', step: 3 },
    in_service: { label: 'In Service', badgeClass: 'status-in-service', step: 4 },
    completed: { label: 'Completed', badgeClass: 'status-completed', step: 5 },
    cancelled: { label: 'Cancelled', badgeClass: 'status-cancelled', step: 0 },
    no_show: { label: 'No Show', badgeClass: 'status-no-show', step: 0 },
  };

  const currentStatus = statusMap[booking.status] || {
    label: booking.status,
    badgeClass: 'status-confirmed',
    step: 2,
  };

  const handleCancel = () => {
    setActionError(null);
    const fd = new FormData();
    fd.append('appointmentId', booking.id);
    if (cancelReason) fd.append('reason', cancelReason);

    startTransition(async () => {
      const res = await cancelCustomerAppointment({}, fd);
      if (res.error) setActionError(res.error);
      else {
        setActionMessage(res.message || 'Booking cancelled.');
        setShowCancelDialog(false);
      }
    });
  };

  const handleReschedule = () => {
    if (!newDateStr) return;
    setActionError(null);
    const combinedIso = `${newDateStr}T${newTimeStr}:00+05:30`;
    const fd = new FormData();
    fd.append('appointmentId', booking.id);
    fd.append('newStartsAt', new Date(combinedIso).toISOString());

    startTransition(async () => {
      const res = await rescheduleCustomerAppointment({}, fd);
      if (res.error) setActionError(res.error);
      else {
        setActionMessage(res.message || 'Rescheduled successfully.');
        setShowRescheduleDialog(false);
      }
    });
  };

  const handleFeedback = () => {
    setActionError(null);
    const fd = new FormData();
    fd.append('appointmentId', booking.id);
    fd.append('rating', String(feedbackRating));
    if (feedbackComment) fd.append('comment', feedbackComment);

    startTransition(async () => {
      const res = await submitCustomerFeedback({}, fd);
      if (res.error) setActionError(res.error);
      else {
        setActionMessage('Thank you for rating your visit!');
        setShowFeedbackDialog(false);
      }
    });
  };

  const exportIcs = () => {
    const start = new Date(booking.startsAt);
    const end = new Date(start.getTime() + booking.durationMinutes * 60000);
    const formatIcs = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `UID:${booking.id}@glowdesk.com`,
      `DTSTAMP:${formatIcs(new Date())}`,
      `DTSTART:${formatIcs(start)}`,
      `DTEND:${formatIcs(end)}`,
      `SUMMARY:${booking.salon.name} - ${booking.serviceName}`,
      `DESCRIPTION:Booking Reference: ${referenceCode}\\nBranch: ${booking.branch.name}, ${booking.branch.address}`,
      `LOCATION:${booking.branch.name}, ${booking.branch.address}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${referenceCode}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <article className="customer-booking-card">
      <div className="booking-card-top">
        <div className="booking-ref-group">
          <span className="booking-ref-badge">{referenceCode}</span>
          <span className={`booking-status-pill ${currentStatus.badgeClass}`}>
            {currentStatus.label}
          </span>
        </div>
        <div className="booking-salon-meta">
          <h3>{booking.salon.name}</h3>
          <p className="muted">
            <CustomerIcon name="mapPin" size={13} /> {booking.branch.name}
            {booking.branch.address ? ` · ${booking.branch.address}` : ''}
          </p>
        </div>
      </div>

      {/* Booking Timeline Tracker (for active bookings) */}
      {isUpcoming && booking.status !== 'cancelled' && (
        <div className="booking-status-timeline" aria-label="Visit progress">
          {[
            { label: 'Confirmed', step: 2 },
            { label: 'Checked In', step: 3 },
            { label: 'In Service', step: 4 },
            { label: 'Completed', step: 5 },
          ].map((s) => (
            <div
              key={s.label}
              className={`timeline-step ${currentStatus.step >= s.step ? 'active' : ''} ${currentStatus.step === s.step ? 'current' : ''}`}
            >
              <span className="dot" />
              <span className="label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main Details Grid */}
      <div className="booking-details-grid">
        <div className="detail-item">
          <span className="label">Date & Time</span>
          <strong className="value">{formattedDate} IST</strong>
        </div>

        <div className="detail-item">
          <span className="label">Service</span>
          <strong className="value">{booking.serviceName}</strong>
          <small className="muted">{booking.durationMinutes} mins · Pay at salon</small>
        </div>

        <div className="detail-item">
          <span className="label">Specialist</span>
          <strong className="value">{booking.assignedStaff?.displayName || 'Assigned Specialist'}</strong>
        </div>

        <div className="detail-item">
          <span className="label">Amount</span>
          <strong className="value price-paise">₹{(booking.pricePaise / 100).toLocaleString('en-IN')}</strong>
        </div>
      </div>

      {actionMessage && <p className="status" style={{ margin: '14px 0' }}>{actionMessage}</p>}
      {actionError && <p className="status error" style={{ margin: '14px 0' }}>{actionError}</p>}

      {/* Customer Action Buttons */}
      <div className="booking-actions-footer">
        {isUpcoming && ['pending', 'confirmed'].includes(booking.status) && (
          <>
            <button
              type="button"
              className="secondary btn-sm"
              onClick={() => setShowRescheduleDialog(true)}
            >
              Reschedule
            </button>
            <button
              type="button"
              className="danger-link btn-sm"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel Visit
            </button>
            <button type="button" className="icon-link-btn" onClick={exportIcs} title="Export to Calendar">
              <CustomerIcon name="calendar" size={14} /> Calendar invite
            </button>
          </>
        )}

        {/* Rebook CTA */}
        <Link
          href={`/customer/book?salonId=${booking.salon.id}&branchId=${booking.branch.id}`}
          className="primary btn-sm"
        >
          One-Tap Rebook ↻
        </Link>

        {/* Completed Feedback Action */}
        {booking.status === 'completed' && !booking.feedback && (
          <button
            type="button"
            className="secondary btn-sm"
            onClick={() => setShowFeedbackDialog(true)}
          >
            ★ Rate & Review
          </button>
        )}

        {booking.feedback && (
          <span className="feedback-done-pill">
            ★ {booking.feedback.rating}/5 Rated
          </span>
        )}
      </div>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>Cancel Appointment?</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Are you sure you want to cancel your visit at {booking.salon.name} on {formattedDate}?
            </p>
            <div className="field" style={{ margin: '15px 0' }}>
              <label>Reason for cancellation (optional)</label>
              <input
                type="text"
                placeholder="e.g. Schedule conflict, feeling unwell"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={isPending}
                onClick={() => setShowCancelDialog(false)}
              >
                Keep Appointment
              </button>
              <button
                type="button"
                className="primary btn-danger"
                disabled={isPending}
                onClick={handleCancel}
              >
                {isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Dialog */}
      {showRescheduleDialog && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>Reschedule Appointment</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Pick a new date and time for your visit at {booking.salon.name}.
            </p>
            <div className="field" style={{ margin: '15px 0' }}>
              <label>Select New Date</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={newDateStr}
                onChange={(e) => setNewDateStr(e.target.value)}
                required
              />
            </div>
            <div className="field" style={{ margin: '15px 0' }}>
              <label>Select New Time</label>
              <select value={newTimeStr} onChange={(e) => setNewTimeStr(e.target.value)}>
                {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'].map((t) => (
                  <option key={t} value={t}>
                    {t} IST
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={isPending}
                onClick={() => setShowRescheduleDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={isPending || !newDateStr}
                onClick={handleReschedule}
              >
                {isPending ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Dialog */}
      {showFeedbackDialog && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>How was your visit?</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Share your feedback for {booking.serviceName} at {booking.salon.name}.
            </p>
            <div className="rating-selector" style={{ margin: '16px 0', display: 'flex', gap: 10 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  className={`star-select-btn ${feedbackRating >= star ? 'active' : ''}`}
                  onClick={() => setFeedbackRating(star)}
                >
                  ★ {star}
                </button>
              ))}
            </div>
            <div className="field" style={{ margin: '15px 0' }}>
              <label>Comments or Review</label>
              <textarea
                rows={3}
                placeholder="What did you love about your service and stylist?"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={isPending}
                onClick={() => setShowFeedbackDialog(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="primary"
                disabled={isPending}
                onClick={handleFeedback}
              >
                {isPending ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
