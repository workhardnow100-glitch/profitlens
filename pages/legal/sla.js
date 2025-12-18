// pages/legal/sla.js
import React from "react";

export default function SLAPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Service Level Agreement (SLA)</h1>
      <p className="text-sm text-slate-500 mb-8">
        Last updated: {new Date().toLocaleDateString("en-GB")}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
        <p className="mb-3">
          This Service Level Agreement (&quot;SLA&quot;) forms part of the Terms &amp;
          Conditions between <strong>ProfitLens Technologies Ltd</strong>, trading as{" "}
          <strong>ProfitLens UK</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;),
          and the customer using the ProfitLens platform (&quot;you&quot;, &quot;your&quot;).
        </p>
        <p className="mb-3">
          This SLA describes our uptime commitments, support response times, and
          maintenance procedures for the ProfitLens platform (the &quot;Service&quot;).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Scope</h2>
        <p className="mb-3">This SLA applies to:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>The ProfitLens web application</li>
          <li>API services</li>
          <li>Data processing and storage</li>
          <li>Customer support</li>
        </ul>
        <p className="mb-3">This SLA does not apply to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Third‑party integrations (e.g., bank feeds)</li>
          <li>User device or network issues</li>
          <li>Browser incompatibility</li>
          <li>Force majeure events</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Uptime Commitment</h2>
        <p className="mb-3">
          ProfitLens UK aims to provide <strong>99.5% uptime</strong> per calendar month.
        </p>
        <p className="mb-3">This excludes:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Scheduled maintenance</li>
          <li>Emergency maintenance</li>
          <li>Third‑party outages</li>
          <li>User‑caused issues</li>
          <li>Force majeure events</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Scheduled Maintenance</h2>
        <p className="mb-3">
          We may perform scheduled maintenance to deploy updates, improve performance, or
          apply security patches.
        </p>
        <p className="mb-3">
          We will provide at least <strong>24 hours’ notice</strong> for scheduled
          maintenance where reasonably possible.
        </p>
        <p className="mb-3">Maintenance typically occurs during low‑traffic hours.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Emergency Maintenance</h2>
        <p className="mb-3">
          We may perform emergency maintenance without notice if required to fix critical
          issues, address security vulnerabilities, or prevent data loss.
        </p>
        <p className="mb-3">
          We will notify users as soon as reasonably possible following emergency work.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Support Availability</h2>
        <p className="mb-3">Support is available via email:</p>
        <p className="mb-3">
          <strong>Email:</strong>{" "}
          <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
            support@profitlens.co.uk
          </a>
        </p>
        <p className="mb-3">Support hours:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Monday–Friday</li>
          <li>09:00–17:00 (UK time)</li>
          <li>Excluding UK public holidays</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Support Response Times</h2>
        <p className="mb-3">We aim to respond within:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li><strong>Critical issues:</strong> 4 business hours</li>
          <li><strong>High‑priority issues:</strong> 1 business day</li>
          <li><strong>Standard issues:</strong> 2–3 business days</li>
          <li><strong>Low‑priority requests:</strong> Up to 5 business days</li>
        </ul>
        <p className="mb-3">These are targets, not guarantees.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Data Backups &amp; Recovery</h2>
        <p className="mb-3">ProfitLens UK performs:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Daily encrypted backups</li>
          <li>Off‑site redundancy</li>
          <li>Disaster recovery procedures</li>
        </ul>
        <p className="mb-3">
          In the event of data loss caused by our systems, we aim to restore service within{" "}
          <strong>24 hours</strong>.
        </p>
        <p className="mb-3">
          We are not responsible for data deleted or corrupted due to user actions.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Service Credits</h2>
        <p className="mb-3">
          If uptime falls below <strong>99.5%</strong> in a calendar month, users may
          request:
        </p>
        <p className="mb-3">
          <strong>Service credit equal to 10% of the monthly subscription fee.</strong>
        </p>
        <p className="mb-3">Conditions:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Must be requested within 30 days of the incident</li>
          <li>Does not apply to annual plans (unless pro‑rated)</li>
          <li>Cannot exceed 50% of the monthly fee</li>
          <li>Cannot be exchanged for cash</li>
        </ul>
        <p className="mb-3">
          Service credits are the <strong>sole remedy</strong> for downtime.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">10. Exclusions</h2>
        <p className="mb-3">This SLA does not apply to downtime caused by:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>User error</li>
          <li>Internet or network issues outside our control</li>
          <li>Browser incompatibility</li>
          <li>Third‑party outages</li>
          <li>Force majeure events</li>
          <li>Beta or experimental features</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">11. User Responsibilities</h2>
        <p className="mb-3">You agree to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Maintain accurate account information</li>
          <li>Use supported browsers and devices</li>
          <li>Ensure stable internet connectivity</li>
          <li>Report issues promptly</li>
          <li>Not misuse or overload the Service</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-3">12. Changes to This SLA</h2>
        <p className="mb-3">
          We may update this SLA from time to time. Continued use of the Service
          constitutes acceptance of the updated terms.
        </p>
      </section>

      <p className="text-sm text-slate-500">
        If you have any questions about this Service Level Agreement, please contact{" "}
        <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
          support@profitlens.co.uk
        </a>
        .
      </p>
    </div>
  );
}
