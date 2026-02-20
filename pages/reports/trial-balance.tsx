// pages/trial-balance.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]";
import { TrialBalanceTable } from "../../components/trial-balance/TrialBalanceTable";

export default async function TrialBalancePage() {
  // 🔹 Load the logged‑in user's session
  const session = await getServerSession(authOptions);

  // 🔹 Extract clientId from session
  const clientId = session?.user?.clientId;

  if (!clientId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Trial Balance</h1>
        <p className="text-red-600 mt-2">
          No client selected. Please log in again.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Trial Balance</h1>
      <p className="text-gray-600">
        A summary of all account balances for this client.
      </p>

      {/* 🔥 Now uses the REAL logged‑in client */}
      <TrialBalanceTable clientId={clientId} />
    </div>
  );
}
