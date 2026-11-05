export type CustomerSalonSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  rating: number;
  reviewCount: number;
  branches: {
    id: string;
    name: string;
    address: string;
    phone: string;
  }[];
  services: {
    id: string;
    name: string;
    category: string;
    durationMinutes: number;
    pricePaise: number;
  }[];
  startingPricePaise: number;
};

export type CustomerSalonDetail = {
  openingHour?: number;
  closingHour?: number;
  id: string;
  name: string;
  slug: string;
  status: string;
  rating: number;
  reviewCount: number;
  branches: {
    id: string;
    name: string;
    address: string;
    phone: string;
  }[];
  services: {
    id: string;
    name: string;
    category: string;
    durationMinutes: number;
    pricePaise: number;
    kind: string;
    checklist: string[];
    eligibleUserIds: string[];
  }[];
  staff: {
    id: string;
    userId: string;
    displayName: string;
    role: string;
  }[];
};

export type CustomerBookingItem = {
  id: string;
  startsAt: string; // ISO string
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
  serviceName: string;
  durationMinutes: number;
  pricePaise: number;
  recurrenceKey?: string | null;
  salon: {
    id: string;
    name: string;
    slug: string;
  };
  branch: {
    id: string;
    name: string;
    address: string;
    phone: string;
  };
  assignedStaff?: {
    id: string;
    displayName: string;
  } | null;
  feedback?: {
    rating: number;
    comment: string | null;
  } | null;
};

export type TimeSlot = {
  timeStr: string; // "10:00 AM"
  isoString: string; // "2026-11-04T04:30:00.000Z"
  available: boolean;
  reason?: string;
  availableStaffIds?: string[];
};

export type CustomerLoyaltyInfo = {
  points: number;
  membershipName: string;
  referralCode: string;
  salonName: string;
};

export type CustomerOfferItem = {
  id: string;
  code: string;
  name: string;
  kind: 'percentage' | 'fixed';
  value: number; // percentage in basis points (e.g. 2000 = 20%) or fixed in paise
  expiresAt: string;
  salonName: string;
};
