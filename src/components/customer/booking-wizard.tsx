'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { CustomerIcon } from './icons';
import { bookCustomerAppointment } from '@/server/customer-booking-actions';
import type { CustomerSalonDetail, TimeSlot } from '@/lib/customer/types';

const salonDate = (date: Date) => new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 10);

type Props = {
  salons: CustomerSalonDetail[];
  preselectedSalonId?: string;
  preselectedBranchId?: string;
  preselectedServiceId?: string;
  preselectedStaffId?: string;
  customerProfile: {
    displayName: string;
    phone: string;
    email: string;
  };
};

export function BookingWizard({
  salons,
  preselectedSalonId,
  preselectedBranchId,
  preselectedServiceId,
  preselectedStaffId,
  customerProfile,
}: Props) {
  const initialSalon = salons.find((s) => s.id === preselectedSalonId) || salons[0];
  const initialBranch = initialSalon?.branches.find((b) => b.id === preselectedBranchId) || initialSalon?.branches[0];

  const [step, setStep] = useState<number>(1);
  const [selectedSalonId, setSelectedSalonId] = useState<string>(initialSalon?.id || '');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranch?.id || '');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    initialSalon?.services.some(s => s.id === preselectedServiceId) ? [preselectedServiceId!] : [],
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string>(initialSalon?.staff.some(s => s.userId === preselectedStaffId) ? preselectedStaffId! : '');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return salonDate(tomorrow);
  });
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [contactPhone, setContactPhone] = useState<string>(customerProfile.phone || '');
  const [notes, setNotes] = useState<string>('');
  const [whatsappConsent, setWhatsappConsent] = useState<boolean>(true);

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmedReference, setConfirmedReference] = useState<string | null>(null);

  const activeSalon = salons.find((s) => s.id === selectedSalonId) || salons[0];
  const activeBranch = activeSalon?.branches.find((b) => b.id === selectedBranchId) || activeSalon?.branches[0];
  const selectedServices = (activeSalon?.services || []).filter((s) => selectedServiceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalPricePaise = selectedServices.reduce((acc, s) => acc + s.pricePaise, 0);
  const selectedStaff = activeSalon?.staff.find((st) => st.userId === selectedStaffId);

  // Generate the next 14 selectable dates
  const availableDates: { dateStr: string; label: string; dayName: string; dayNum: number }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const dateStr = salonDate(d);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
    const dayNum = Number(new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'Asia/Kolkata' }).format(d));
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
    availableDates.push({ dateStr, label, dayName, dayNum });
  }

  // Fetch slots whenever branch, duration, staff, or date changes
  useEffect(() => {
    const controller = new AbortController();
    setSelectedSlot(null);
    if (!selectedSalonId || !selectedBranchId || totalDuration === 0) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }

    setLoadingSlots(true);
    setActionError(null);
    const params = new URLSearchParams({
      salonId: selectedSalonId,
      branchId: selectedBranchId,
      durationMinutes: String(totalDuration),
      date: selectedDate,
      serviceIds: selectedServiceIds.join(','),
    });
    if (selectedStaffId) {
      params.set('staffId', selectedStaffId);
    }

    fetch(`/api/customer/availability?${params.toString()}`, { signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error("Unable to check availability."); return res.json(); })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.slots && Array.isArray(data.slots)) {
          setSlots(data.slots);

        } else {
          setSlots([]);
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setActionError("Unable to check availability. Please try again.");
        setSlots([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false);
      });
    return () => controller.abort();
  }, [selectedSalonId, selectedBranchId, totalDuration, selectedStaffId, selectedDate, selectedServiceIds]);

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId],
    );
  };

  const handleConfirmBooking = () => {
    if (!selectedSlot || loadingSlots || !selectedSlot.available) return;
    setActionError(null);

    const formData = new FormData();
    formData.append('salonId', selectedSalonId);
    formData.append('branchId', selectedBranchId);
    selectedServiceIds.forEach((id) => formData.append('serviceIds', id));
    if (selectedStaffId) formData.append('assignedUserId', selectedStaffId);
    formData.append('startsAt', selectedSlot.isoString);
    if (notes) formData.append('notes', notes);
    if (contactPhone) formData.append('contactPhone', contactPhone);
    if (whatsappConsent) formData.append('whatsappConsent', 'on');

    startTransition(async () => {
      const res = await bookCustomerAppointment({}, formData);
      if (res.error) {
        setActionError(res.error);
      } else if (res.bookingReference) {
        setConfirmedReference(res.bookingReference);
        setStep(7);
      }
    });
  };

  const generateIcsCalendar = () => {
    if (!selectedSlot) return;
    const start = new Date(selectedSlot.isoString);
    const end = new Date(start.getTime() + totalDuration * 60000);
    const formatIcsTime = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GlowDesk//Customer Booking//EN',
      'BEGIN:VEVENT',
      `UID:${confirmedReference || 'GD-APPT'}@glowdesk.com`,
      `DTSTAMP:${formatIcsTime(new Date())}`,
      `DTSTART:${formatIcsTime(start)}`,
      `DTEND:${formatIcsTime(end)}`,
      `SUMMARY:${activeSalon?.name || 'Salon'} - ${selectedServices.map((s) => s.name).join(' & ')}`,
      `DESCRIPTION:Booking Reference: ${confirmedReference}\\nLocation: ${activeBranch?.name || ''}, ${activeBranch?.address || ''}\\nPayment: Pay at salon`,
      `LOCATION:${activeBranch?.name || ''}, ${activeBranch?.address || ''}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `GlowDesk-Booking-${confirmedReference || 'Visit'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  };

  return (
    <div className="customer-booking-wizard">
      {/* Step Indicators */}
      <div className="wizard-progress-bar" aria-label="Booking steps">
        {[
          { num: 1, label: 'Salon' },
          { num: 2, label: 'Services' },
          { num: 3, label: 'Stylist' },
          { num: 4, label: 'Date & Time' },
          { num: 5, label: 'Details' },
          { num: 6, label: 'Review' },
        ].map((s) => (
          <div
            key={s.num}
            className={`wizard-step-node ${step === s.num ? 'current' : step > s.num ? 'completed' : ''}`}
            onClick={() => step < 7 && !isPending && s.num < step && setStep(s.num)}
          >
            <span className="step-circle">{step > s.num ? '✓' : s.num}</span>
            <span className="step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {actionError && (
        <div className="status error" role="alert" style={{ marginBottom: 20 }}>
          {actionError}
        </div>
      )}

      {/* STEP 1: Select Salon & Branch */}
      {step === 1 && (
        <section className="wizard-step-panel">
          <div className="step-header">
            <h2>Select Salon & Location</h2>
            <p className="muted">Choose your preferred salon and the branch most convenient for you.</p>
          </div>

          <div className="salon-selection-grid">
            {salons.map((salon) => (
              <div
                key={salon.id}
                className={`salon-option-card ${selectedSalonId === salon.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedSalonId(salon.id);
                  setSelectedServiceIds([]);
                  setSelectedStaffId('');
                  setSelectedBranchId('');
                  setSelectedSlot(null);
                  if (salon.branches.length > 0) {
                    setSelectedBranchId(salon.branches[0].id);
                  }
                }}
              >
                <div className="salon-option-header">
                  <h3>{salon.name}</h3>
                  <span className="badge">★ {salon.rating}</span>
                </div>
                <p className="muted" style={{ fontSize: 13, margin: '6px 0 12px' }}>
                  {salon.branches.length} Location{salon.branches.length > 1 ? 's' : ''} · From ₹{(salon.services[0]?.pricePaise ? Math.min(...salon.services.map((s) => s.pricePaise)) / 100 : 350).toLocaleString('en-IN')}
                </p>

                {selectedSalonId === salon.id && (
                  <div className="branch-selector-group">
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--plum)' }}>
                      CHOOSE BRANCH
                    </label>
                    <div className="branch-pills">
                      {salon.branches.map((b) => (
                        <button
                          type="button"
                          key={b.id}
                          className={`branch-pill ${selectedBranchId === b.id ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBranchId(b.id);
                          }}
                        >
                          <strong>{b.name}</strong>
                          {b.address && <small>{b.address}</small>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="wizard-nav-actions">
            <button
              type="button"
              className="primary"
              disabled={!selectedSalonId || !selectedBranchId}
              onClick={() => setStep(2)}
            >
              Continue to Services <span>→</span>
            </button>
          </div>
        </section>
      )}

      {/* STEP 2: Select Services */}
      {step === 2 && (
        <section className="wizard-step-panel">
          <div className="step-header">
            <h2>Select Service(s)</h2>
            <p className="muted">
              Choose one or multiple services. You can combine a haircut with grooming or treatments.
            </p>
          </div>

          <div className="services-selection-list">
            {activeSalon?.services.map((srv) => {
              const isChecked = selectedServiceIds.includes(srv.id);
              return (
                <div
                  key={srv.id}
                  className={`service-select-row ${isChecked ? 'selected' : ''}`}
                  onClick={() => toggleService(srv.id)}
                >
                  <div className="service-row-check">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleService(srv.id)}
                      aria-label={`Select ${srv.name}`}
                    />
                  </div>
                  <div className="service-row-info">
                    <h4>{srv.name}</h4>
                    <div className="service-meta-tags">
                      <span className="category-tag">{srv.category}</span>
                      <span className="duration-tag">
                        <CustomerIcon name="clock" size={12} /> {srv.durationMinutes} mins
                      </span>
                    </div>
                    {srv.checklist.length > 0 && (
                      <p className="service-steps-preview">
                        Includes: {srv.checklist.slice(0, 3).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="service-row-price">
                    <strong>₹{(srv.pricePaise / 100).toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Summary Tray */}
          {selectedServices.length > 0 && (
            <div className="service-tray-bar">
              <div className="tray-details">
                <span>{selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected</span>
                <strong>{totalDuration} mins · ₹{(totalPricePaise / 100).toLocaleString('en-IN')}</strong>
              </div>
              <div className="tray-policy-note">Pay at salon upon completion</div>
            </div>
          )}

          <div className="wizard-nav-actions">
            <button type="button" className="secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              className="primary"
              disabled={selectedServiceIds.length === 0}
              onClick={() => setStep(3)}
            >
              Choose Specialist <span>→</span>
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: Choose Stylist */}
      {step === 3 && (
        <section className="wizard-step-panel">
          <div className="step-header">
            <h2>Choose Stylist / Professional</h2>
            <p className="muted">
              Select a preferred specialist or select "Any Available" for the widest appointment availability.
            </p>
          </div>

          <div className="staff-selection-grid">
            <div
              className={`staff-card ${selectedStaffId === '' ? 'selected' : ''}`}
              onClick={() => setSelectedStaffId('')}
            >
              <div className="staff-avatar sparkle-avatar">✧</div>
              <div className="staff-info">
                <h4>Any Available Specialist</h4>
                <p className="muted">Maximum slot flexibility & shortest wait</p>
              </div>
              <span className="staff-check">{selectedStaffId === '' ? '✓' : ''}</span>
            </div>

            {activeSalon?.staff.map((member) => (
              <div
                key={member.userId}
                className={`staff-card ${selectedStaffId === member.userId ? 'selected' : ''}`}
                onClick={() => setSelectedStaffId(member.userId)}
              >
                <div className="staff-avatar">
                  {member.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="staff-info">
                  <h4>{member.displayName}</h4>
                  <p className="muted">{member.role === 'owner' ? 'Lead Stylist & Owner' : member.role === 'manager' ? 'Master Specialist' : 'Specialist'}</p>
                </div>
                <span className="staff-check">{selectedStaffId === member.userId ? '✓' : ''}</span>
              </div>
            ))}
          </div>

          <div className="wizard-nav-actions">
            <button type="button" className="secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" className="primary" onClick={() => setStep(4)}>
              Select Date & Time <span>→</span>
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: Select Date & Time Slot */}
      {step === 4 && (
        <section className="wizard-step-panel">
          <div className="step-header">
            <h2>Select Date & Time</h2>
            <p className="muted">
              Live available time slots for {totalDuration} mins service at {activeBranch?.name}.
            </p>
          </div>

          {/* Date Picker Carousel */}
          <div className="date-picker-carousel" role="radiogroup" aria-label="Available dates">
            {availableDates.map((item) => (
              <button
                type="button"
                key={item.dateStr}
                className={`date-tile ${selectedDate === item.dateStr ? 'active' : ''}`}
                onClick={() => setSelectedDate(item.dateStr)}
              >
                <span className="day-name">{item.dayName}</span>
                <strong className="day-num">{item.dayNum}</strong>
                <span className="day-label">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Slot Grid */}
          <div className="slots-container">
            <div className="slots-header">
              <h3>Available Slots for {new Date(selectedDate + 'T00:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              {loadingSlots && <span className="loading-spinner">Checking live calendar...</span>}
            </div>

            {loadingSlots ? (
              <div className="slots-loading-state">
                <p>Verifying stylist schedule and salon availability...</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="empty-slots-state">
                <CustomerIcon name="calendar" size={32} />
                <p>No available slots found on this date.</p>
                <small className="muted">Try selecting another date or switching to "Any Available Specialist".</small>
              </div>
            ) : (
              <div className="slots-grid">
                {slots.map((slot) => {
                  const isSelected = selectedSlot?.isoString === slot.isoString;
                  return (
                    <button
                      type="button"
                      key={slot.isoString}
                      disabled={!slot.available}
                      className={`time-slot-pill ${isSelected ? 'selected' : ''} ${!slot.available ? 'disabled' : ''}`}
                      onClick={() => slot.available && setSelectedSlot(slot)}
                    >
                      <CustomerIcon name="clock" size={14} />
                      <span>{slot.timeStr}</span>
                      {!slot.available && <span className="slot-badge">Taken</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="wizard-nav-actions">
            <button type="button" className="secondary" onClick={() => setStep(3)}>
              Back
            </button>
            <button
              type="button"
              className="primary"
              disabled={!selectedSlot || loadingSlots}
              onClick={() => setStep(5)}
            >
              Enter Details <span>→</span>
            </button>
          </div>
        </section>
      )}

      {/* STEP 5: Customer Details & Notes */}
      {step === 5 && (
        <section className="wizard-step-panel">
          <div className="step-header">
            <h2>Your Details & Notes</h2>
            <p className="muted">Confirm your contact information and leave any special requests for your stylist.</p>
          </div>

          <div className="form details-form">
            {!customerProfile.displayName ? (
              <div className="guest-login-notice" style={{ padding: '1rem', background: '#fdf2f8', borderRadius: '8px', border: '1px solid #fbcfe8', marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#9d174d' }}>
                  Please sign in to secure this booking
                </p>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#831843' }}>
                  Your appointment confirmation and reference code will be linked to your GlowDesk account.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Link
                    href="/customer/login"
                    className="btn primary"
                    style={{ display: 'inline-block', padding: '0.5rem 1rem', fontSize: '0.875rem', textDecoration: 'none', cursor: 'pointer' }}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/customer/register"
                    className="secondary"
                    style={{ display: 'inline-block', padding: '0.5rem 1rem', fontSize: '0.875rem', textDecoration: 'none', cursor: 'pointer' }}
                  >
                    Create account
                  </Link>
                </div>
              </div>
            ) : (
              <div className="field">
                <label>Full Name</label>
                <input type="text" value={customerProfile.displayName} readOnly className="read-only-field" />
                <span className="hint">Linked to your GlowDesk client account</span>
              </div>
            )}

            <div className="field">
              <label htmlFor="contactPhone">Mobile Phone (for updates & reminders)</label>
              <input
                id="contactPhone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
                required
                suppressHydrationWarning
              />
            </div>

            <div className="field">
              <label htmlFor="bookingNotes">Special Requests or Preferences (Optional)</label>
              <textarea
                id="bookingNotes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Skin sensitive to hot water, preferred fade level, etc."
                maxLength={500}
              />
            </div>

            <label className="consent">
              <input
                type="checkbox"
                checked={whatsappConsent}
                onChange={(e) => setWhatsappConsent(e.target.checked)}
              />
              <span>Send instant booking confirmation and 24-hour reminder via WhatsApp/SMS</span>
            </label>
          </div>

          <div className="wizard-nav-actions">
            <button type="button" className="secondary" onClick={() => setStep(4)}>
              Back
            </button>
            <button
              type="button"
              className="primary"
              disabled={!contactPhone.trim() || !customerProfile.displayName}
              onClick={() => setStep(6)}
            >
              Review & Confirm <span>→</span>
            </button>
          </div>
        </section>
      )}

      {/* STEP 6: Review and Confirm */}
      {step === 6 && (
        <section className="wizard-step-panel">
          <div className="step-header">
            <h2>Review & Confirm Booking</h2>
            <p className="muted">Please double check your visit summary before confirming.</p>
          </div>

          <div className="booking-summary-card">
            <div className="summary-salon-header">
              <div>
                <h3>{activeSalon?.name}</h3>
                <p className="muted">{activeBranch?.name} · {activeBranch?.address || 'Main Location'}</p>
              </div>
              <span className="badge">Pay at Salon</span>
            </div>

            <div className="summary-rows">
              <div className="summary-row">
                <span className="label">Date & Time</span>
                <strong>
                  {selectedSlot &&
                    new Date(selectedSlot.isoString).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      dateStyle: 'full',
                      timeStyle: 'short',
                    })}
                </strong>
              </div>

              <div className="summary-row">
                <span className="label">Specialist</span>
                <strong>{selectedStaff?.displayName || 'First Available Specialist'}</strong>
              </div>

              <div className="summary-row">
                <span className="label">Services ({selectedServices.length})</span>
                <div>
                  {selectedServices.map((srv) => (
                    <div key={srv.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                      <span>{srv.name} ({srv.durationMinutes}m)</span>
                      <strong>₹{(srv.pricePaise / 100).toLocaleString('en-IN')}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="summary-row total-row">
                <span className="label">Total Duration & Estimate</span>
                <div>
                  <span className="muted" style={{ marginRight: 15 }}>{totalDuration} mins</span>
                  <strong className="total-amount">₹{(totalPricePaise / 100).toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>

            {/* Pay at Salon Policy Banner */}
            <div className="policy-guarantee-card">
              <CustomerIcon name="shieldCheck" size={24} className="policy-icon" />
              <div>
                <h4>Zero Prepayment Required</h4>
                <p>
                  Your booking is guaranteed. Pay at the salon reception upon service completion via Cash, UPI, or Card.
                  Free cancellation or rescheduling up to 2 hours before.
                </p>
              </div>
            </div>
          </div>

          <div className="wizard-nav-actions">
            <button type="button" className="secondary" disabled={isPending} onClick={() => setStep(5)}>
              Back
            </button>
            <button
              type="button"
              className="primary confirm-btn"
              disabled={isPending}
              onClick={handleConfirmBooking}
            >
              {isPending ? 'Confirming with Salon...' : 'Confirm Appointment ✓'}
            </button>
          </div>
        </section>
      )}

      {/* STEP 7: Confirmation */}
      {step === 7 && (
        <section className="wizard-step-panel confirmation-panel">
          <div className="confirmation-badge-icon">✓</div>
          <h2>Booking Confirmed!</h2>
          <p className="eyebrow" style={{ color: 'var(--plum)', margin: '8px 0' }}>
            Reference: {confirmedReference}
          </p>
          <p className="muted" style={{ maxWidth: 450, margin: '0 auto 24px' }}>
            We look forward to seeing you at {activeSalon?.name} ({activeBranch?.name}). A notification has been queued for your visit.
          </p>

          <div className="confirmation-card">
            <div className="conf-item">
              <CustomerIcon name="calendar" size={18} />
              <span>
                {selectedSlot &&
                  new Date(selectedSlot.isoString).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
              </span>
            </div>
            <div className="conf-item">
              <CustomerIcon name="mapPin" size={18} />
              <span>{activeBranch?.name} — {activeBranch?.address || 'Main studio'}</span>
            </div>
            <div className="conf-item">
              <CustomerIcon name="scissors" size={18} />
              <span>{selectedServices.map((s) => s.name).join(', ')}</span>
            </div>
            <div className="conf-item">
              <CustomerIcon name="profile" size={18} />
              <span>Stylist: {selectedStaff?.displayName || 'Assigned Specialist'}</span>
            </div>
          </div>

          <div className="confirmation-actions">
            <button type="button" className="secondary" onClick={generateIcsCalendar}>
              <CustomerIcon name="calendar" size={16} /> Add to Calendar (.ics)
            </button>
            <Link href="/customer/bookings" className="primary">
              View My Bookings ↗
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
