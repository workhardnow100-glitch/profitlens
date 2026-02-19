import { TrialBalanceTable } from "../../components/trial-balance/TrialBalanceTable";

export default function TrialBalancePage() {
  // For now, hardcode your client ID (you can swap to session later)
  const clientId = "11111111-1111-1111-1111-111111111111";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Trial Balance</h1>
      <p className="text-gray-600">
        A summary of all account balances for this client.
      </p>

      <TrialBalanceTable clientId={clientId} />
    </div>
  );
}
