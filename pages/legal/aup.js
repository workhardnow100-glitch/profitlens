// pages/legal/aup.js
import React from "react";

export default function AcceptableUsePolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Acceptable Use Policy</h1>
      <p className="text-sm text-slate-500 mb-8">
        Last updated: {new Date().toLocaleDateString("en-GB")}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
        <p className="mb-3">
          This Acceptable Use Policy (&quot;AUP&quot;) forms part of the Terms &amp;
          Conditions governing your use of the ProfitLens platform (&quot;the
          Service&quot;), provided by <strong>ProfitLens Technologies Ltd</strong>,
          trading as <strong>ProfitLens UK</strong> (&quot;we&quot;, &quot;us&quot;,
          &quot;our&quot;).
        </p>
        <p className="mb-3">
          By using the Service, you agree to comply with this AUP. Failure to
          comply may result in suspension or termination of your account.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. General Principles</h2>
        <p className="mb-3">Users must:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Use the Service lawfully</li>
          <li>Respect the rights of others</li>
          <li>Protect the security of their account</li>
          <li>Use the Service only for legitimate bookkeeping purposes</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Prohibited Activities</h2>

        <h3 className="font-semibold mb-2">3.1 Illegal Activities</h3>
        <p className="mb-3">You may not use the Service to:</p>
        <ul className="list-disc pl-6 space-y-1 mb-4">
          <li>Commit or facilitate fraud</li>
          <li>Evade taxes</li>
          <li>Launder money</li>
          <li>Upload or store illegal content</li>
          <li>Violate HMRC regulations</li>
        </ul>

        <h3 className="font-semibold mb-2">3.2 Security Violations</h3>
        <ul className="list-disc pl-6 space-y-1 mb-4">
          <li>Bypass authentication or access controls</li>
          <li>Probe, scan, or test system vulnerabilities</li>
          <li>Interfere with security features</li>
          <li>Deploy malware, bots, or automated scripts</li>
          <li>Reverse‑engineer the platform</li>
        </ul>

        <h3 className="font-semibold mb-2">3.3 Misuse of the Platform</h3>
        <ul className="list-disc pl-6 space-y-1 mb-4">
          <li>Upload harmful or malicious files</li>
          <li>Manipulate data to mislead tax calculations</li>
          <li>Degrade platform performance</li>
          <li>Circumvent subscription fees</li>
          <li>Share your account with others</li>
          <li>Create multiple accounts to abuse free trials</li>
        </ul>

        <h3 className="font-semibold mb-2">3.4 Inappropriate Content</h3>
        <ul className="list-disc pl-6 space-y-1 mb-4">
          <li>Offensive, abusive, or discriminatory content</li>
          <li>Pornographic or explicit material</li>
          <li>Personal data unrelated to bookkeeping</li>
          <li>Special category data unless strictly necessary</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Fair Usage</h2>
        <p className="mb-3">Users must not:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Upload excessive volumes of irrelevant data</li>
          <li>Use automated tools to scrape or extract data</li>
          <li>Overload the system with repeated requests</li>
        </ul>
        <p className="mb-3">
          We may apply rate limits or storage limits where necessary.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Third‑Party Integrations</h2>
        <p className="mb-3">
          If you connect external services (e.g., bank feeds), you must:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Comply with their terms</li>
          <li>Not misuse integrations</li>
          <li>Not falsify imported data</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Account Security</h2>
        <p className="mb-3">You must:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Keep your password confidential</li>
          <li>Use a strong password</li>
          <li>Notify us of unauthorised access</li>
          <li>Not share login credentials</li>
        </ul>
        <p className="mb-3">
          You are responsible for all activity under your account.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Enforcement</h2>
        <p className="mb-3">We may take action if this AUP is violated, including:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Warning notices</li>
          <li>Temporary suspension</li>
          <li>Permanent account termination</li>
          <li>Reporting illegal activity to authorities</li>
          <li>Legal action where necessary</li>
        </ul>
        <p className="mb-3">
          We reserve the right to determine what constitutes a violation.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-3">8. Reporting Violations</h2>
        <p className="mb-3">
          If you believe someone is violating this AUP, contact:
        </p>
        <p className="mb-3">
          <strong>Email:</strong>{" "}
          <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
            support@profitlens.co.uk
          </a>
        </p>
      </section>

      <p className="text-sm text-slate-500">
        If you have any questions about this Acceptable Use Policy, please contact{" "}
        <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
          support@profitlens.co.uk
        </a>
        .
      </p>
    </div>
  );
}
