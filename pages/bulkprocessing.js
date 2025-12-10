// pages/bulkprocessing.js
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

export default function BulkProcessing() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  // 🔑 Access check
  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      const isAdmin = session.user.role === "admin";
      const isSubscribed = ["basic", "pro"].includes(session.user.subscriptionStatus);

      if (!(isAdmin || isSubscribed)) {
        router.replace("/upgrade");
      }
    } else {
      router.replace("/login");
    }
  }, [session, status, router]);

  const handleUpload = async () => {
    if (!files.length) {
      alert("Please select at least one file.");
      return;
    }

    const clientId = session?.user?.clientId;
    const email = session?.user?.email;
    if (!clientId || !email) {
      alert("Session missing identifiers. Please log in again.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("clientId", clientId);
      formData.append("userId", session.user.id);
      formData.append("email", email);

      const res = await fetch("/api/upload/bulk", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      const result = contentType.includes("application/json")
        ? JSON.parse(text)
        : { raw: text };

      if (!res.ok) {
        const message = result?.error || result?.message || "Upload failed";
        throw new Error(message);
      }

      // 🔒 Audit log
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          user: email,
          action: "Bulk upload",
          details: `${files.length} file(s) uploaded`,
        }),
      });

      alert(result.message || "Bulk upload complete.");
      router.push("/dashboard");
    } catch (err) {
      console.error("Bulk upload error:", err);
      alert(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleAttachBank = () => {
    const clientId = session?.user?.clientId;
    if (!clientId) {
      alert("Session missing clientId. Please log in again.");
      return;
    }
    window.location.href = `/api/truelayer/auth?client_id=${clientId}`;
  };

  const handleRefreshBankData = async () => {
    const clientId = session?.user?.clientId;
    if (!clientId) {
      alert("Session missing clientId. Please log in again.");
      return;
    }

    setRefreshing(true);
    try {
      const res = await fetch(`/api/truelayer/pull?client_id=${clientId}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Refresh failed");

      // 🔒 Audit log
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          user: session.user.email,
          action: "Refresh bank data",
          details: "Triggered TrueLayer pull",
        }),
      });

      alert("Bank data refreshed successfully.");
      router.push("/dashboard");
    } catch (err) {
      console.error("Refresh error:", err);
      alert(err?.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col">
      <h1 className="text-2xl font-bold mb-4">Bulk Statement Upload</h1>

      <input
        type="file"
        multiple
        accept=".csv,.xlsx"
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        className="mb-4"
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="bg-blue-600 px-4 py-2 rounded"
        >
          {uploading ? "Uploading..." : "Upload Statements"}
        </button>

        <button
          onClick={handleAttachBank}
          className="bg-green-600 px-4 py-2 rounded"
        >
          Attach Bank to ProfitLens
        </button>

        <button
          onClick={handleRefreshBankData}
          disabled={refreshing}
          className="bg-yellow-500 px-4 py-2 rounded text-black"
        >
          {refreshing ? "Refreshing..." : "Refresh Bank Data"}
        </button>
      </div>

      {/* Banner at the bottom */}
      <div className="mt-auto flex justify-center">
        <img
          src="/banner.png"
          alt="Powered by ProfitLens, Supabase & AWS"
          className="h-200"
        />
      </div>
    </div>
  );
}
