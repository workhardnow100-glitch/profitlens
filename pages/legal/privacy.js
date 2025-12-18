// pages/legal/privacy.js
import React from "react";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">
        Last updated: {new Date().toLocaleDateString("en-GB")}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
        <p className="mb-3">
          This Privacy Policy explains how <strong>ProfitLens Technologies Ltd</strong>,
          trading as <strong>ProfitLens UK</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;),
          collects, uses, stores, and protects your personal data when you use our
          website, applications, and services (the &quot;Service&quot;).
        </p>
        <p className="mb-3">
          We are committed to complying with the UK General Data Protection Regulation
          (UK GDPR), the Data Protection Act 2018, and the Privacy and Electronic
          Communications Regulations (PECR).
        </p>
        <p className="mb-3">
          By using the Service, you agree to the practices described in this Privacy Policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Who We Are (Data Controller)</h2>
        <p className="mb-3">
          The Service is operated by <strong>ProfitLens Technologies Ltd</strong>,
          trading as <strong>ProfitLens UK</strong>. We act as the <strong>Data Controller</strong>
          for all personal data processed through the Service.
        </p>
        <p className="mb-3">
          For privacy enquiries or GDPR requests, contact:
        </p>
        <p className="mb-3">
          <strong>Email:</strong>{" "}
          <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
            support@profitlens.co.uk
          </a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Data We Collect</h2>

        <h3 className="font-semibold mb-2">3.1 Account Information</h3>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Name</li>
          <li>Email address</li>
          <li>Password (encrypted)</li>
          <li>Business details</li>
          <li>Subscription status</li>
        </ul>

        <h3 className="font-semibold mb-2">3.2 Financial Data</h3>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Bank transactions</li>
          <li>Uploaded receipts and documents</li>
          <li>Transaction categorisation data</li>
          <li>Tax estimation inputs</li>
        </ul>

        <h3 className="font-semibold mb-2">3.3 Technical Data</h3>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>IP address</li>
          <li>Device and browser information</li>
          <li>Usage logs</li>
          <li>Cookies and tracking data</li>
        </ul>

        <h3 className="font-semibold mb-2">3.4 Communication Data</h3>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Support messages</li>
          <li>Emails</li>
          <li>Feedback submissions</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          4. How We Use Your Data (Lawful Basis)
        </h2>

        <h3 className="font-semibold mb-2">4.1 Contractual Necessity</h3>
        <p className="mb-3">To provide and operate the Service, including:</p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Account creation</li>
          <li>Transaction processing</li>
          <li>Tax estimation</li>
          <li>Subscription management</li>
        </ul>

        <h3 className="font-semibold mb-2">4.2 Legitimate Interests</h3>
        <p className="mb-3">For purposes such as:</p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Improving the platform</li>
          <li>Preventing fraud</li>
          <li>Ensuring security</li>
        </ul>

        <h3 className="font-semibold mb-2">4.3 Legal Obligations</h3>
        <p className="mb-3">To comply with UK law, including:</p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Tax and accounting regulations</li>
          <li>Anti‑fraud requirements</li>
        </ul>

        <h3 className="font-semibold mb-2">4.4 Consent</h3>
        <p className="mb-3">For optional features such as:</p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Marketing emails</li>
          <li>Analytics cookies</li>
        </ul>
        <p className="mb-3">You may withdraw consent at any time.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. How We Share Your Data</h2>
        <p className="mb-3">We may share data with trusted third‑party providers, including:</p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Cloud hosting providers</li>
          <li>Payment processors</li>
          <li>Analytics tools</li>
          <li>Customer support platforms</li>
        </ul>
        <p className="mb-3">
          All third‑party processors are GDPR‑compliant and bound by Data Processing Agreements.
        </p>
        <p className="mb-3 font-semibold">We never sell personal data.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. International Transfers</h2>
        <p className="mb-3">
          If personal data is transferred outside the UK, we ensure appropriate safeguards such as:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Adequacy regulations</li>
          <li>Standard Contractual Clauses (SCCs)</li>
          <li>Equivalent protections</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
        <p className="mb-3">
          We retain personal data for as long as necessary to provide the Service, and for up to{" "}
          <strong>6 years</strong> after account closure to comply with legal obligations.
        </p>
        <p className="mb-3">
          You may request deletion where legally permitted (see Section 8).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Your GDPR Rights</h2>
        <p className="mb-3">You have the right to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Access your data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion</li>
          <li>Restrict processing</li>
          <li>Object to processing</li>
          <li>Export your data</li>
          <li>Withdraw consent</li>
        </ul>
        <p className="mb-3">
          To exercise your rights, contact{" "}
          <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
            support@profitlens.co.uk
          </a>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Cookies</h2>
        <p className="mb-3">
          We use essential cookies, analytics cookies, and functional cookies. Full details are
          provided in our Cookie Policy.
        </p>
        <p className="mb-3">
          Non‑essential cookies are only used with your consent.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">10. Security</h2>
        <p className="mb-3">
          We use industry‑standard security measures including encryption, access controls,
          secure cloud infrastructure, and regular audits. Full details are available in our
          Security Statement.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">11. Children’s Data</h2>
        <p className="mb-3">
          The Service is not intended for users under 18. We do not knowingly collect data from minors.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-3">12. Changes to This Policy</h2>
        <p className="mb-3">
          We may update this Privacy Policy from time to time. Continued use of the Service
          constitutes acceptance of the updated policy.
        </p>
      </section>

      <p className="text-sm text-slate-500">
        If you have any questions about this Privacy Policy, please contact us at{" "}
        <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
          support@profitlens.co.uk
        </a>
        .
      </p>
    </div>
  );
}
