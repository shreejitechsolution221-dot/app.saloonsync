import { CustomerShell } from '@/components/customer/shell';
import { authConfigured } from '@/lib/auth/config';
import { supabase } from '@/lib/auth/supabase';
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

  if (authConfigured()) {
    try {
      const client = await supabase();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (user) {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { displayName: true },
        });

        if (dbUser) {
          displayName = dbUser.displayName || 'Member';
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
      }
    } catch {
      // Unauthenticated visitor
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
