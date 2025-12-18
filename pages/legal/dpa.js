// pages/legal/dpa.js
import React from "react";

export default function DPAPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Data Processing Agreement (DPA)</h1>
      <p className="text-sm text-slate-500 mb-8">
        Last updated: {new Date().toLocaleDateString("en-GB")}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
        <p className="mb-3">
          This Data Processing Agreement (&quot;DPA&quot;) forms part of the Terms &amp;
          Conditions between <strong>ProfitLens Technologies Ltd</strong>, trading as{" "}
          <strong>ProfitLens UK</strong> (&quot;Processor&quot;, &quot;we&quot;, &quot;us&quot;),
          and the customer using the ProfitLens platform (&quot;Controller&quot;, &quot;you&quot;).
        </p>
        <p className="mb-3">
          This DPA governs how we process personal data on your behalf in accordance with:
        </p>
        <ul className="list-disc pl-6 mb-3 space-y-1">
          <li>UK GDPR</li>
          <li>Data Protection Act 2018</li>
          <li>Applicable UK privacy laws</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Definitions</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Controller:</strong> The individual or business determining the purposes
            and means of processing personal data.
          </li>
          <li>
            <strong>Processor:</strong> ProfitLens Technologies Ltd, processing data on
            behalf of the Controller.
          </li>
          <li>
            <strong>Personal Data:</strong> Any information relating to an identifiable
            individual.
          </li>
          <li>
            <strong>Processing:</strong> Any operation performed on personal data.
          </li>
          <li>
            <strong>Sub‑processor:</strong> A third party engaged by the Processor to assist
            in processing.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Subject Matter of Processing</h2>
        <p className="mb-3">
          ProfitLens UK processes personal data for the purpose of providing bookkeeping,
          financial analysis, and tax‑estimation tools, including:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Transaction import and categorisation</li>
          <li>Financial dashboards and reporting</li>
          <li>Tax estimation and modelling</li>
          <li>Document and receipt storage</li>
          <li>Subscription and account management</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Duration</h2>
        <p className="mb-3">
          This DPA remains in effect for the duration of your ProfitLens account and until
          all personal data has been deleted or returned to you.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          5. Nature and Categories of Data Processed
        </h2>

        <h3 className="font-semibold mb-2">5.1 Personal Data</h3>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Name and contact details</li>
          <li>Email address</li>
          <li>Business information</li>
          <li>Financial transaction data</li>
          <li>Uploaded documents and receipts</li>
          <li>IP address and device data</li>
        </ul>

        <h3 className="font-semibold mb-2">5.2 Special Category Data</h3>
        <p className="mb-3">
          ProfitLens UK does <strong>not</strong> intentionally process special category
          data. Users must not upload such data unless strictly necessary.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          6. Obligations of the Processor (ProfitLens UK)
        </h2>

        <h3 className="font-semibold mb-2">6.1 Process Only on Documented Instructions</h3>
        <p className="mb-3">
          We will only process personal data as required to provide the Service and in
          accordance with your instructions.
        </p>

        <h3 className="font-semibold mb-2">6.2 Confidentiality</h3>
        <p className="mb-3">
          All staff and contractors with access to personal data are bound by strict
          confidentiality obligations.
        </p>

        <h3 className="font-semibold mb-2">6.3 Security Measures</h3>
        <p className="mb-3">We implement industry‑standard security measures, including:</p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Encryption at rest and in transit</li>
          <li>Access controls and authentication</li>
          <li>Secure cloud infrastructure</li>
          <li>Regular audits and monitoring</li>
          <li>Backup and disaster recovery procedures</li>
        </ul>

        <h3 className="font-semibold mb-2">6.4 Assistance with GDPR Rights</h3>
        <p className="mb-3">
          We will assist you in responding to data subject requests, including access,
          correction, deletion, and portability.
        </p>

        <h3 className="font-semibold mb-2">6.5 Breach Notification</h3>
        <p className="mb-3">
          We will notify you without undue delay if we become aware of a personal data
          breach affecting your data.
        </p>

        <h3 className="font-semibold mb-2">6.6 Data Deletion or Return</h3>
        <p className="mb-3">
          Upon account closure, we will delete or return personal data unless retention is
          required by law.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Sub‑processors</h2>
        <p className="mb-3">
          ProfitLens UK uses trusted third‑party providers to deliver the Service, including:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Cloud hosting providers</li>
          <li>Payment processors</li>
          <li>Analytics tools</li>
          <li>Customer support platforms</li>
        </ul>
        <p className="mb-3">
          All sub‑processors are GDPR‑compliant and bound by written agreements. You
          authorise our use of sub‑processors.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. International Transfers</h2>
        <p className="mb-3">
          If personal data is transferred outside the UK, we ensure appropriate safeguards,
          such as:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Adequacy regulations</li>
          <li>Standard Contractual Clauses (SCCs)</li>
          <li>Equivalent protections</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          9. Obligations of the Controller (the User)
        </h2>
        <p className="mb-3">You agree to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Ensure you have a lawful basis for processing personal data</li>
          <li>Not upload unlawful or inappropriate data</li>
          <li>Keep login credentials secure</li>
          <li>Comply with all applicable data protection laws</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">10. Audit Rights</h2>
        <p className="mb-3">
          You may request information demonstrating our compliance with this DPA. Formal
          audits may be conducted with reasonable notice and at your expense.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">11. Liability</h2>
        <p className="mb-3">
          Liability is governed by the Terms &amp; Conditions. Nothing in this DPA limits
          rights that cannot be excluded under UK law.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
        <p className="mb-3">
          This DPA terminates automatically when your ProfitLens account is closed and all
          personal data has been deleted or returned.
        </p>
      </section>

      <p className="text-sm text-slate-500">
        If you have any questions about this Data Processing Agreement, please contact{" "}
        <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
          support@profitlens.co.uk
        </a>
        .
      </p>
    </div>
  );
}
