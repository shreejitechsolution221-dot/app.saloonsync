import { expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const m = vi.hoisted(() => ({
  user: { id: '11111111-1111-4111-8111-111111111111', displayName: 'Jane Doe', email: 'jane@example.com', mobileNumber: '+919876543210' },
  dashboard: {
    user: { id: '11111111-1111-4111-8111-111111111111', displayName: 'Jane Doe', phone: '+919876543210' },
    upcomingBooking: {
      id: 'appt-1',
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'confirmed',
      serviceName: 'Signature Haircut',
      durationMinutes: 45,
      pricePaise: 65000,
      salon: { id: 's1', name: 'Micasa Saloon', slug: 'micasa-saloon' },
      branch: { id: 'b1', name: 'Thaltej Branch', address: 'Main road', phone: '9876543210' },
      assignedStaff: { id: 'st1', displayName: 'Preet Gajjar' },
    },
    recentPastBookings: [],
    featuredSalons: [
      {
        id: 's1',
        name: 'Micasa Saloon',
        slug: 'micasa-saloon',
        status: 'active',
        rating: 4.9,
        reviewCount: 38,
        branches: [{ id: 'b1', name: 'Thaltej Branch', address: 'Main road', phone: '9876543210' }],
        services: [{ id: 'srv1', name: 'Signature Haircut', category: 'Hair', durationMinutes: 45, pricePaise: 65000 }],
        startingPricePaise: 65000,
      },
    ],
    loyaltyPoints: 500,
    activeOffers: [],
  },
  explore: {
    salons: [
      {
        id: 's1',
        name: 'Micasa Saloon',
        slug: 'micasa-saloon',
        status: 'active',
        rating: 4.9,
        reviewCount: 38,
        branches: [{ id: 'b1', name: 'Thaltej Branch', address: 'Main road', phone: '9876543210' }],
        services: [{ id: 'srv1', name: 'Signature Haircut', category: 'Hair', durationMinutes: 45, pricePaise: 65000 }],
        startingPricePaise: 65000,
      },
    ],
    categories: ['All', 'Hair', 'Grooming', 'Color', 'Spa', 'Facial'],
    totalCount: 1,
  },
  profile: {
    id: 's1',
    name: 'Micasa Saloon',
    slug: 'micasa-saloon',
    status: 'active',
    rating: 4.9,
    reviewCount: 42,
    branches: [{ id: 'b1', name: 'Thaltej Branch', address: 'Main road', phone: '9876543210' }],
    services: [
      {
        id: 'srv1',
        name: 'Signature Haircut',
        category: 'Hair',
        durationMinutes: 45,
        pricePaise: 65000,
        kind: 'service',
        checklist: ['Wash', 'Cut'],
        eligibleUserIds: [],
      },
    ],
    staff: [{ id: 'm1', userId: 'u1', displayName: 'Preet Gajjar', role: 'owner' }],
  },
  bookings: {
    upcoming: [
      {
        id: 'appt-1',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'confirmed',
        serviceName: 'Signature Haircut',
        durationMinutes: 45,
        pricePaise: 65000,
        salon: { id: 's1', name: 'Micasa Saloon', slug: 'micasa-saloon' },
        branch: { id: 'b1', name: 'Thaltej Branch', address: 'Main road', phone: '9876543210' },
        assignedStaff: { id: 'st1', displayName: 'Preet Gajjar' },
        feedback: null,
      },
    ],
    past: [],
  },
}));

vi.mock('@/lib/auth/page-guard', () => ({
  guard: async (_portal: string, fn: () => Promise<unknown>) => fn(),
}));

vi.mock('@/lib/authorization/server', () => ({
  requireCustomerUser: async () => m.user,
}));
vi.mock('@/lib/customer/identity', () => ({ optionalCustomerUser: async () => m.user }));

vi.mock('@/lib/customer/queries', () => ({
  getCustomerDashboardData: async () => m.dashboard,
  getExploreSalonsData: async () => m.explore,
  getSalonProfileData: async () => m.profile,
  getCustomerBookings: async () => m.bookings,
}));

import CustomerHomePage from '@/app/customer/page';
import ExploreSalonsPage from '@/app/customer/explore/page';
import CustomerBookingsPage from '@/app/customer/bookings/page';
import CustomerSalonProfilePage from '@/app/customer/salons/[salonId]/page';

it('renders Customer Home page with hero, search, upcoming visit, categories, and zero-prepayment guarantees', async () => {
  const html = renderToStaticMarkup(await CustomerHomePage());
  expect(html).toContain('Hello, Jane Doe.');
  expect(html).toContain('Your Next Appointment');
  expect(html).toContain('Micasa Saloon');
  expect(html).toContain('Signature Haircut');
  expect(html).toContain('Haircuts &amp; Styling');
  expect(html).toContain('Pay at Salon');
});

it('renders Explore Salons page with search filters and salon cards', async () => {
  const html = renderToStaticMarkup(await ExploreSalonsPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('Explore Salons &amp; Specialists');
  expect(html).toContain('Micasa Saloon');
  expect(html).toContain('Thaltej Branch');
  expect(html).toContain('Book Visit');
  expect(html).toContain('Hair');
});

it('renders My Bookings page with upcoming visit card and actions', async () => {
  const html = renderToStaticMarkup(await CustomerBookingsPage({ searchParams: Promise.resolve({ tab: 'upcoming' }) }));
  expect(html).toContain('My Appointments');
  expect(html).toContain('Upcoming Visits (1)');
  expect(html).toContain('Micasa Saloon');
  expect(html).toContain('Confirmed');
  expect(html).toContain('Reschedule');
  expect(html).toContain('Cancel Visit');
  expect(html).toContain('One-Tap Rebook');
});

it('renders Salon Profile page with services menu and zero prepayment policy', async () => {
  const html = renderToStaticMarkup(await CustomerSalonProfilePage({ params: Promise.resolve({ salonId: 's1' }) }));
  expect(html).toContain('Micasa Saloon');
  expect(html).toContain('Service Menu');
  expect(html).toContain('Signature Haircut');
  expect(html).toContain('Zero Prepayment Required');
  expect(html).toContain('Preet Gajjar');
});
