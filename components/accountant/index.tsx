// pages/accountants/index.tsx
import AuditTrail from "../../components/accountant/AuditTrail";
import ExportQueue from "../../components/accountant/ExportQueue";
import ChartingModule from "../../components/accountant/ChartingModule";
import ForecastTool from "../../components/accountant/ForecastTool";
import StatementVault from "../../components/accountant/StatementVault";

export default function AccountantsPage() {
  return (
    <main className="p-8 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Accountants Dashboard
      </h1>

      <section>
        <AuditTrail />
      </section>

      <section>
        <ExportQueue />
      </section>

      <section>
        <ChartingModule />
      </section>

      <section>
        <ForecastTool />
      </section>

      <section>
        <StatementVault />
      </section>
    </main>
  );
}
