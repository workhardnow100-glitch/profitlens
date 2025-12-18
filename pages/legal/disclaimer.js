// pages/legal/disclaimer.js
import React from "react";

export default function DisclaimerPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Website Disclaimer</h1>
      <p className="text-sm text-slate-500 mb-8">
        Last updated: {new Date().toLocaleDateString("en-GB")}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. General Information</h2>
        <p className="mb-3">
          The information provided by <strong>ProfitLens Technologies Ltd</strong>,
          trading as <strong>ProfitLens UK</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;),
          on this website and through the ProfitLens platform is for general
          information and bookkeeping purposes only.
        </p>
        <p className="mb-3">
          While we strive to keep information accurate and up to date, we make no
          representations or warranties of any kind, express or implied, about the
          accuracy, completeness, reliability, suitability, or availability of any
          information, calculations, or outputs provided by the Service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          2. No Tax, Accounting, or Legal Advice
        </h2>
        <p className="mb-3">
          ProfitLens UK is <strong>not</strong> a tax advisor, accountant, or legal
          professional. Nothing on this website or within the platform constitutes:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Tax advice</li>
          <li>Accounting advice</li>
          <li>Legal advice</li>
          <li>Financial advice</li>
        </ul>
        <p className="mb-3">
          Users should consult a qualified professional before making decisions or
          filing tax returns.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. User Responsibility</h2>
        <p className="mb-3">You are solely responsible for:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>The accuracy of the data you enter</li>
          <li>Reviewing all calculations and outputs</li>
          <li>Ensuring compliance with HMRC requirements</li>
          <li>Filing your own tax returns</li>
          <li>Seeking professional advice where necessary</li>
        </ul>
        <p className="mb-3">
          ProfitLens UK does not file tax returns on your behalf unless explicitly
          stated and authorised.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Limitation of Liability</h2>
        <p className="mb-3">
          To the fullest extent permitted by UK law, we are not liable for:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Errors in tax calculations or estimates</li>
          <li>Incorrect categorisation of transactions</li>
          <li>Missed deadlines, penalties, or interest charged by HMRC</li>
          <li>Losses arising from reliance on the Service</li>
          <li>Data entered incorrectly by the user</li>
          <li>Third‑party integration errors</li>
        </ul>
        <p className="mb-3">
          Use of the Service is at your own risk. You must independently verify all
          figures before relying on them.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-3">5. External Links</h2>
        <p className="mb-3">
          Our website may contain links to third‑party websites. We do not control or
          endorse the content of external sites and are not responsible for their
          accuracy, security, or practices.
        </p>
      </section>

      <p className="text-sm text-slate-500">
        If you have any questions about this Website Disclaimer, please contact{" "}
        <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
          support@profitlens.co.uk
        </a>
        .
      </p>
    </div>
  );
}
