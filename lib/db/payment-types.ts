export type OrderStatus =
  'PENDING_PAYMENT' | 'PAYMENT_REVIEW' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED' | 'REJECTED';

export type PaymentMethod = 'BANK_TRANSFER' | 'MOMO';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface PlusPlan {
  id: string;
  durationMonths: number;
  price: number;
  currency: 'VND';
  title: string;
}

export const PLUS_PLANS: Record<string, PlusPlan> = {
  PLUS_6M: {
    id: 'PLUS_6M',
    durationMonths: 6,
    price: 349000,
    currency: 'VND',
    title: 'Tú Tài Plus - 6 tháng',
  },
  PLUS_12M: {
    id: 'PLUS_12M',
    durationMonths: 12,
    price: 599000,
    currency: 'VND',
    title: 'Tú Tài Plus - 12 tháng',
  },
};

export interface PlusOrder {
  id: string;
  code: string;
  userId: string;
  planId: string;
  amount: number;
  currency: 'VND';
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  createdAt: string; // ISO string
  expiresAt?: string; // ISO string
  paidAt?: string; // ISO string
  paymentReference?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface PlusSubscription {
  userId: string;
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  status: SubscriptionStatus;
  updatedAt: string; // ISO string
}
