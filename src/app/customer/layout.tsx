import { CustomerShell } from '@/components/customer/shell';
import { optionalCustomerUser } from '@/lib/customer/identity';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let displayName = 'Guest';
  let totalPoints = 0;
  let isLoggedIn = false;

  const user = await optionalCustomerUser();
  if (user) {
    displayName = user.displayName || 'Member';
    isLoggedIn = true;
    const salonCustomers = await db.salonCustomer.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    if (salonCustomers.length > 0) {
      const loyaltyAccounts = await db.loyaltyAccount.findMany({
        where: { customerId: { in: salonCustomers.map((c) => c.id) } },
        select: { points: true },
      });
      totalPoints = loyaltyAccounts.reduce((acc, curr) => acc + curr.points, 0);
    }
  }

  return (
    <CustomerShell
      active=""
      userName={displayName}
      loyaltyPoints={totalPoints}
      isLoggedIn={isLoggedIn}
    >
      {children}
    </CustomerShell>
  );
}
