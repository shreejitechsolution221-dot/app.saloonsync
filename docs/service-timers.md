# Appointment service timers

Starting a service records its actual start time in the appointment audit event.
The countdown ends after the booked service duration. Reloading the calendar does
not restart the clock. Complete service remains available for finishing early.

The appointment screen checks elapsed services every 15 seconds while visible.
An open popup attempts completion at the end of its countdown. The server checks
the recorded start time before completing; browser time cannot finish a service
early. Checklist, stock, commission and feedback rules still apply. A failed
completion leaves the appointment in service for an operator to resolve.

For completion with no appointment screen open, configure a scheduler to send
`POST /api/internal/services` every minute, with
`Authorization: Bearer <SERVICE_WORKER_SECRET>`. Set that environment variable to
at least 32 random characters. Each call processes up to 25 due services; adjust
the schedule for higher throughput. The endpoint is authenticated and uncached.
This repository change does not provision the scheduler.

Existing in-service appointments with a recorded `appointment.in_service` audit
event also retain their countdown. Appointments without a recorded start can be
completed manually; no start time is guessed from their scheduled time.
