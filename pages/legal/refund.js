// pages/legal/refund.js
import React from "react";

export default function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Refund Policy</h1>
      <p className="text-sm text-slate-500 mb-8">
        Last updated: {new Date().toLocaleDateString("en-GB")}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
        <p className="mb-3">
          This Refund Policy explains how refunds, cancellations, and billing
          disputes are handled by <strong>ProfitLens Technologies Ltd</strong>,
          trading as <strong>ProfitLens UK</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
        </p>
        <p className="mb-3">
          By subscribing to ProfitLens UK, you agree to this Refund Policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Free Trial</h2>
        <p className="mb-3">
          ProfitLens UK may offer a <strong>24‑hour free trial</strong> for new users.
          During the trial:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>You may cancel at any time</li>
          <li>No payment will be taken</li>
          <li>
            If you do not cancel before the trial ends, your subscription will
            automatically convert to a paid plan
          </li>
        </ul>
        <p className="mb-3">The free trial is limited to one per user.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Subscription Billing</h2>
        <p className="mb-3">
          We offer monthly and annual subscription plans. All subscriptions renew
          automatically unless cancelled.
        </p>
        <p className="mb-3">
          Payments are processed at the start of each billing period using your
          chosen payment method.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Cancellation Policy</h2>
        <p className="mb-3">
          You may cancel your subscription at any time through your account
          settings.
        </p>
        <p className="mb-3">
          When you cancel:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Your subscription remains active until the end of the current billing period</li>
          <li>You will not be charged again</li>
          <li>No refunds are issued for unused time</li>
        </ul>
        <p className="mb-3">
          This applies to both monthly and annual plans.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Refund Eligibility</h2>
        <p className="mb-3">Refunds are only issued in the following circumstances:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li><strong>Duplicate payments</strong> caused by a system error</li>
          <li>
            <strong>Platform‑wide technical issues</strong> preventing access for more
            than 48 consecutive hours
          </li>
          <li><strong>Legal requirements</strong> under UK consumer law</li>
        </ul>

        <p className="mb-3 font-semibold">Refunds are NOT issued for:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Change of mind</li>
          <li>Failure to cancel before renewal</li>
          <li>Partial use of the Service</li>
          <li>Incorrect data entered by the user</li>
          <li>Tax calculation errors</li>
          <li>Inability to use the Service due to user device or network issues</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Annual Subscription Refunds</h2>
        <p className="mb-3">
          Annual plans are discounted and therefore:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li><strong>Non‑refundable</strong> after the first 14 days</li>
          <li>
            Refunds within 14 days are only available if the Service has not been
            used beyond basic account setup
          </li>
        </ul>
        <p className="mb-3">
          This aligns with UK digital content regulations.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Chargebacks &amp; Disputes</h2>
        <p className="mb-3">
          If you initiate a chargeback:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Your account may be suspended</li>
          <li>We will provide evidence to the payment provider</li>
          <li>We may refuse future service</li>
        </ul>
        <p className="mb-3">
          We encourage contacting us first to resolve billing issues.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-3">8. How to Request a Refund</h2>
        <p className="mb-3">
          To request a refund, contact:
        </p>
        <p className="mb-3">
          <strong>Email:</strong>{" "}
          <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
            support@profitlens.co.uk
          </a>
        </p>
        <p className="mb-3">
          Please include:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Your account email</li>
          <li>Transaction ID</li>
          <li>Reason for the request</li>
        </ul>
        <p className="mb-3">
          We aim to respond within <strong>5 business days</strong>.
        </p>
      </section>

      <p className="text-sm text-slate-500">
        If you have any questions about this Refund Policy, please contact{" "}
        <a href="mailto:support@profitlens.co.uk" className="text-blue-600 underline">
          support@profitlens.co.uk
        </a>
        .
      </p>
    </div>
  );
}
