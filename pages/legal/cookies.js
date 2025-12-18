// pages/legal/cookies.js
import React from "react";

export default function CookiePolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Cookie Policy</h1>
      <p className="text-sm text-slate-500 mb-8">
        Last updated: {new Date().toLocaleDateString("en-GB")}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
        <p className="mb-3">
          This Cookie Policy explains how <strong>ProfitLens Technologies Ltd</strong>,
          trading as <strong>ProfitLens UK</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;),
          uses cookies and similar technologies on our website and applications
          (the &quot;Service&quot;).
        </p>
        <p className="mb-3">
          By using the Service, you consent to the use of cookies as described in this
          policy, unless you disable them through your browser or our cookie settings panel.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. What Are Cookies?</h2>
        <p className="mb-3">
          Cookies are small text files stored on your device when you visit a website.
          They help websites function, improve performance, and provide analytics.
        </p>
        <p className="mb-3">Cookies may be:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Session cookies</strong> – deleted when you close your browser</li>
          <li><strong>Persistent cookies</strong> – remain until they expire or are deleted</li>
          <li><strong>First‑party cookies</strong> – set by ProfitLens UK</li>
          <li><strong>Third‑party cookies</strong> – set by external providers</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Types of Cookies We Use</h2>

        <h3 className="font-semibold mb-2">3.1 Strictly Necessary Cookies (Essential)</h3>
        <p className="mb-3">
          These cookies are required for the Service to function and do not require consent.
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Authentication and login cookies</li>
          <li>Session management</li>
          <li>Security and fraud prevention</li>
          <li>Cookie preference storage</li>
        </ul>

        <h3 className="font-semibold mb-2">3.2 Performance &amp; Analytics Cookies (Consent Required)</h3>
        <p className="mb-3">
          These cookies help us understand how users interact with the platform.
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Page views and navigation patterns</li>
          <li>Error tracking</li>
          <li>Feature usage analytics</li>
        </ul>

        <h3 className="font-semibold mb-2">3.3 Functional Cookies (Consent Required)</h3>
        <p className="mb-3">
          These cookies enhance user experience by remembering preferences.
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Dashboard filters</li>
          <li>UI customisation</li>
        </ul>

        <h3 className="font-semibold mb-2">3.4 Marketing &amp; Third‑Party Cookies</h3>
        <p className="mb-3">
          ProfitLens UK does not currently use advertising cookies. If this changes,
          we will update this policy and request consent.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Third‑Party Cookies</h2>
        <p className="mb-3">
          We may use third‑party services that set their own cookies, including:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Cloud hosting providers</li>
          <li>Analytics tools</li>
          <li>Payment processors</li>
          <li>Customer support platforms</li>
        </ul>
        <p className="mb-3">
          All third‑party providers are GDPR‑compliant and bound by appropriate agreements.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Why We Use Cookies</h2>
        <p className="mb-3">We use cookies to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Keep you logged in</li>
          <li>Secure your account</li>
          <li>Improve platform performance</li>
          <li>Analyse usage patterns</li>
          <li>Remember your preferences</li>
          <li>Provide a personalised experience</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Cookie Duration</h2>
        <p className="mb-3">
          Cookies may last for the duration of your session or persist for up to 12 months,
          depending on their purpose.
        </p>
        <p className="mb-3">
          We do not use cookies with excessive retention periods.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Managing Cookies</h2>
        <p className="mb-3">You can manage or disable cookies through:</p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Your browser settings</li>
          <li>Our cookie consent banner</li>
          <li>Your device privacy settings</li>
        </ul>
        <p className="mb-3">
          Disabling essential cookies may prevent the Service from functioning properly.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Legal Basis for Using Cookies</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Essential cookies:</strong> Legitimate interest / contractual necessity</li>
          <li><strong>Analytics cookies:</strong> Consent</li>
          <li><strong>Functional cookies:</strong> Consent</li>
          <li><strong>Marketing cookies:</strong> Consent</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
        <p className="mb-3">
          We may update this Cookie Policy from time to time. Continued use of the Service
          constitutes acceptance of the updated policy.
        </p>
      </section>

      <p className="text-sm text-slate-500">
        If you have any questions about this Cookie Policy, please contact{" "}
        <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
          support@profitlens.co.uk
        </a>
        .
      </p>
    </div>
  );
}
