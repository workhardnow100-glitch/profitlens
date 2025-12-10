// pages/emailsetup.js
import { useState, useEffect } from "react";
import Layout from "../components/layout";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

export default function EmailSetup() {
  const [appPassword, setAppPassword] = useState("");
  const [status, setStatus] = useState("pending"); // "connected", "failed"
  const [ingestionLog, setIngestionLog] = useState([]);
  const [tagRules, setTagRules] = useState([
    { sender: "bank@hsbc.com", tag: "HSBC" },
    { subjectContains: "Business Account", tag: "Business" },
  ]);
  const [settings, setSettings] = useState({
    parsePDF: true,
    parseCSV: true,
    parseXLSX: false,
    frequency: "monthly",
    autoTag: true,
  });

  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

// 🔑 Access check
useEffect(() => {
  if (authStatus === "loading") return;

  if (session?.user) {
    const isAdmin = session.user.role === "admin";
    // ✅ include basic and trialing in allowed statuses
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      session.user.subscriptionStatus
    );

    if (!(isAdmin || isSubscribedOrTrial)) {
      router.replace("/upgrade");
    }
  } else {
    router.replace("/login");
  }
}, [session, authStatus, router]);


  useEffect(() => {
    // Simulated connection + ingestion log
    setTimeout(() => setStatus("connected"), 1000);
    setIngestionLog([
      { subject: "HSBC Statement - Aug", sender: "bank@hsbc.com", status: "parsed", date: "2025-09-10" },
      { subject: "Business Account Summary", sender: "noreply@barclays.com", status: "parsed", date: "2025-09-08" },
      { subject: "Statement Error", sender: "alerts@monzo.com", status: "failed", date: "2025-09-07" },
    ]);
  }, []);

  const handleTestEmail = () => {
    alert("Test email sent to profitlensappp@gmail.com. Check ingestion log shortly.");
  };

  const handleRuleChange = (index, field, value) => {
    const updated = [...tagRules];
    updated[index][field] = value;
    setTagRules(updated);
  };

  const statusColor = {
    connected: "text-green-600",
    pending: "text-yellow-500",
    failed: "text-red-600",
  };

  return (
    <Layout currentPageName="EmailSetup">
      <div className="p-8 space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Email Integration</h2>
          <p className="text-slate-600 mt-1">
            Automate bank statement ingestion by forwarding emails to ProfitLens. Pro clients get tagging, parsing control, and audit visibility.
          </p>
        </div>

        {/* Setup */}
        <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
          <h3 className="text-xl font-semibold text-slate-800">Setup</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Gmail App Password</label>
              <input
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••••••••"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Forwarding Address</label>
              <div className="flex items-center justify-between border p-2 rounded-lg bg-slate-50">
                <span className="text-slate-800 font-mono">profitlensappp@gmail.com</span>
                <span className={`text-sm font-semibold ${statusColor[status]}`}>
                  {status === "connected" ? "Connected" : status === "pending" ? "Pending" : "Failed"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleTestEmail}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Send Test Email
          </button>
        </div>

        {/* Ingestion Log */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-slate-800 mb-4">Recent Ingested Emails</h3>
          <div className="space-y-3">
            {ingestionLog.map((log, i) => (
              <div key={i} className="flex justify-between items-center border-b pb-2">
                <div>
                  <p className="font-medium text-slate-800">{log.subject}</p>
                  <p className="text-sm text-slate-500">
                    From: {log.sender} • {log.date}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    log.status === "parsed" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {log.status === "parsed" ? "Parsed" : "Failed"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pro-only sections */}
        {session?.user?.subscriptionStatus === "pro" && (
          <>
            {/* Tagging Rules */}
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
              <h3 className="text-xl font-semibold text-slate-800">
                Custom Tagging Rules <span className="text-xs text-indigo-600 ml-2">Pro</span>
              </h3>
              {tagRules.map((rule, i) => (
                <div key={i} className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={rule.sender}
                    onChange={(e) => handleRuleChange(i, "sender", e.target.value)}
                    className="border p-2 rounded-lg"
                    placeholder="Sender email"
                  />
                  <input
                    type="text"
                    value={rule.tag}
                    onChange={(e) => handleRuleChange(i, "tag", e.target.value)}
                    className="border p-2 rounded-lg"
                    placeholder="Tag"
                  />
                </div>
              ))}
            </div>

            {/* Parsing Settings */}
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
              <h3 className="text-xl font-semibold text-slate-800">
                Parsing Settings <span className="text-xs text-indigo-600 ml-2">Pro</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {["parsePDF", "parseCSV", "parseXLSX"].map((key) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={() => setSettings((s) => ({ ...s, [key]: !s[key] }))}
                    />
                    {key.replace("parse", "")}
                  </label>
                ))}
                <label className="col-span-2">
                  Frequency:
                  <select
                    value={settings.frequency}
                    onChange={(e) => setSettings((s) => ({ ...s, frequency: e.target.value }))}
                    className="ml-2 border p-1 rounded"
                  >
                                    <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="adhoc">Ad hoc</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.autoTag}
                onChange={() => setSettings((s) => ({ ...s, autoTag: !s.autoTag }))}
              />
              Auto-tag by sender domain
            </label>
          </div>
        </div>

        {/* Security & Audit */}
        <div className="bg-white p-6 rounded-lg shadow-sm space-y-2">
          <h3 className="text-xl font-semibold text-slate-800">
            Security & Audit <span className="text-xs text-indigo-600 ml-2">Pro</span>
          </h3>
          <p className="text-sm text-slate-500">
            Last Gmail connection: 2025-09-12 • IP: 82.17.44.201
          </p>
          <button className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Revoke Gmail App Password
          </button>
        </div>
      </>
      )}
    </div>
  </Layout>
);
}
