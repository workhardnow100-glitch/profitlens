export type PaymentStats = {
  stripePaymentsCount: number;
  stripePaymentsAmount: string;      // stored as DECIMAL in DB → string in TS
  invoicePaymentsCount: number;
  invoicePaymentsAmount: string;     // same reason
  transactionsCount: number;
  transactionsAmount: string;        // DECIMAL → string
  invoicesCount: number;
};
