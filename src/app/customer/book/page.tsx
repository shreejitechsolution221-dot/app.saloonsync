import Link from 'next/link';
import { optionalCustomerUser } from '@/lib/customer/identity';
import { getSalonProfileData } from '@/lib/customer/queries';
import { BookingWizard } from '@/components/customer/booking-wizard';
import { CustomerIcon } from '@/components/customer/icons';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function CustomerBookPage({
  searchParams,
}: {
  searchParams: Promise<{ salonId?: string; branchId?: string; serviceId?: string; staffId?: string }>;
}) {
  let customerProfile = { displayName: '', phone: '', email: '' };

  const user = await optionalCustomerUser();
  if (user) {
    const profile = await db.customerProfile.findUnique({ where: { userId: user.id }, select: { phone: true } });
    customerProfile = { displayName: user.displayName || 'Member', phone: profile?.phone || user.mobileNumber || '', email: user.email };
  }

  const params = await searchParams;

  // Fetch active salons
  const salonsRaw = await db.salon.findMany({
    where: { status: 'active' },
    select: { id: true },
  });

  const salons = (
    await Promise.all(salonsRaw.map((s) => getSalonProfileData(s.id)))
  ).filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <div className="customer-page book-page">
      <div className="booking-top-nav">
        <Link href="/customer/explore" className="back-nav-link">
          <CustomerIcon name="arrowLeft" size={16} /> Back to Salons
        </Link>
        <span className="booking-security-pill">
          <CustomerIcon name="shieldCheck" size={14} /> Zero Prepayment · Pay at Salon
        </span>
      </div>

      <div className="booking-wizard-header">
        <p className="eyebrow">RESERVE YOUR VISIT</p>
        <h1>Book an Appointment</h1>
        <p className="muted">
          Select your salon, choose services, and pick an available time slot with your stylist.
        </p>
      </div>

      <BookingWizard
        salons={salons}
        preselectedSalonId={params.salonId}
        preselectedBranchId={params.branchId}
        preselectedServiceId={params.serviceId}
        preselectedStaffId={params.staffId}
        customerProfile={customerProfile}
      />
    </div>
  );
}
