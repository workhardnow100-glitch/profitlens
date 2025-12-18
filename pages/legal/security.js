// pages/legal/security.js
import React from "react";

export default function SecurityStatementPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Security Statement</h1>
      <p className="text-sm text-slate-500 mb-8">
        Last updated: {new Date().toLocaleDateString("en-GB")}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
        <p className="mb-3">
          ProfitLens Technologies Ltd, trading as <strong>ProfitLens UK</strong>,
          is committed to maintaining the confidentiality, integrity, and
          availability of user data. This Security Statement outlines the
          technical and organisational measures we use to protect your
          information.
        </p>
        <p className="mb-3">
          Security is a core part of our platform design, development, and
          operations.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Security Principles</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Confidentiality</strong> – Only authorised individuals can access data.</li>
          <li><strong>Integrity</strong> – Data is protected from unauthorised modification.</li>
          <li><strong>Availability</strong> – The Service remains accessible and reliable.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Data Encryption</h2>
        <h3 className="font-semibold mb-2">3.1 Encryption in Transit</h3>
        <p className="mb-3">
          All data transmitted between your device and our servers is encrypted
          using TLS 1.2+.
        </p>

        <h3 className="font-semibold mb-2">3.2 Encryption at Rest</h3>
        <p className="mb-3">
          All stored data, including backups, is encrypted using industry‑standard
          encryption (AES‑256 or equivalent).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Secure Infrastructure</h2>
        <p className="mb-3">ProfitLens UK uses secure cloud infrastructure with:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Physical data centre security</li>
          <li>Redundant power and networking</li>
          <li>Firewalls and intrusion detection</li>
          <li>DDoS protection</li>
          <li>Regular security patching</li>
        </ul>
        <p className="mb-3">We do not host data on local servers.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Access Controls</h2>
        <p className="mb-3">We enforce strict access controls, including:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Role‑based access</li>
          <li>Multi‑factor authentication for internal systems</li>
          <li>Least‑privilege principle</li>
          <li>Logged and monitored access</li>
          <li>Regular access reviews</li>
        </ul>
        <p className="mb-3">
          Only authorised staff can access production systems.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Application Security</h2>
        <p className="mb-3">We follow secure development practices, including:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Code reviews</li>
          <li>Dependency scanning</li>
          <li>Vulnerability testing</li>
          <li>Continuous monitoring</li>
          <li>Secure API design</li>
          <li>Regular penetration testing</li>
        </ul>
        <p className="mb-3">
          Passwords are never stored in plaintext and are hashed using
          industry‑standard algorithms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Data Backups &amp; Disaster Recovery</h2>
        <p className="mb-3">ProfitLens UK performs:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Daily encrypted backups</li>
          <li>Off‑site redundancy</li>
          <li>Disaster recovery planning</li>
          <li>Regular restoration testing</li>
        </ul>
        <p className="mb-3">
          In the event of a major incident, we aim to restore service within{" "}
          <strong>24 hours</strong>.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Monitoring &amp; Logging</h2>
        <p className="mb-3">We monitor:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>System performance</li>
          <li>Authentication attempts</li>
          <li>Suspicious activity</li>
          <li>Error logs</li>
          <li>API usage patterns</li>
        </ul>
        <p className="mb-3">
          Alerts are triggered for unusual or potentially malicious behaviour.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Incident Response</h2>
        <p className="mb-3">
          If a data breach occurs, we will investigate immediately, contain the
          issue, and notify affected users without undue delay.
        </p>
        <p className="mb-3">
          Where required, we will notify the Information Commissioner’s Office (ICO).
        </p>
        <p className="mb-3">
          We maintain an internal incident response plan to ensure rapid action.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">10. Third‑Party Security</h2>
        <p className="mb-3">
          We only work with third‑party providers who meet GDPR requirements and
          implement strong security controls.
        </p>
        <p className="mb-3">Examples include:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Cloud hosting providers</li>
          <li>Payment processors</li>
          <li>Analytics tools</li>
          <li>Customer support platforms</li>
        </ul>
        <p className="mb-3">We never sell personal data.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">11. User Responsibilities</h2>
        <p className="mb-3">Users must:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Use strong passwords</li>
          <li>Keep login credentials secure</li>
          <li>Ensure their devices are protected</li>
          <li>Report suspicious activity promptly</li>
          <li>Not upload harmful or malicious files</li>
        </ul>
        <p className="mb-3">
          Security is a shared responsibility between ProfitLens UK and its users.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-3">12. Continuous Improvement</h2>
        <p className="mb-3">
          We regularly review and update our security measures to address emerging
          threats, improve resilience, and maintain compliance.
        </p>
      </section>

      <p className="text-sm text-slate-500">
        If you have any questions about this Security Statement, please contact{" "}
        <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
          support@profitlens.co.uk
        </a>
        .
      </p>
    </div>
  );
}
