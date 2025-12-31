// pages/payments/index.tsx
import { useUser } from "../../hooks/useUser";

export default function PaymentsPage() {
  const { user } = useUser();

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Payments Cockpit</h1>
      <p className="text-sm text-slate-600">
        This page will show payouts, transactions, and Stripe integration for{" "}
        <strong>{user?.email || "your account"}</strong>.
      </p>
    </div>
  );
}

// 🔒 Force SSR to prevent static export errors
export async function getServerSideProps() {
  return { props: {} };
}
