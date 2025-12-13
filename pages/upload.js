// pages/upload.js
import React, { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Upload() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [sessionUser, setSessionUser] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);

  const { data, error } = useSWR("/api/reports", fetcher);
  const router = useRouter();
  const { data: session, status } = useSession();

  // 🔑 Enforce access
  useEffect(() => {
    if (status === "loading") return;
    if (session?.user) {
      const isAdmin = session.user.role === "admin";
      const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
        session.user.subscriptionStatus
      );
      if (!(isAdmin || isSubscribedOrTrial)) {
        router.replace("/upgrade");
      } else {
        setSessionUser({
          id: session.user.id,
          email: session.user.email,
          clientId: session.user.clientId,
          role: session.user.role,
          subscriptionStatus: session.user.subscriptionStatus,
        });
      }
    } else {
      router.replace("/login");
    }
  }, [session, status, router]);

  const handleUpload = async () => {
    if (!files.length || !sessionUser) {
      setErrorMsg("Missing files or session");
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setUploadSummary(null);

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    formData.append("userId", sessionUser.id);
    formData.append("clientId", sessionUser.clientId);
    formData.append("email", sessionUser.email);

    try {
      const res = await fetch("/api/upload/bulk", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || "Upload failed");

      mutate("/api/reports");
      setUploadSummary(result);
      alert(result.message || "Upload complete");
      router.push("/dashboard");
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ResponsiveLayout>
      <div className="p-8">
        <h2 className="text-2xl font-bold text-slate-800">Upload Statements</h2>
        <p className="text-slate-600 mt-2">
          Upload your bank statements here to begin analysis. Supported formats include CSV and Excel.
          Once uploaded, your data will be parsed and tagged automatically.
        </p>

        <ResponsiveCard title="Upload">
          <input
            type="file"
            multiple
            accept=".csv,.xlsx"
            onChange={(e) => setFiles(Array.from(e.target.files))}
            className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />

          {files.length > 0 && (
            <ul className="text-sm text-slate-700 space-y-1 mt-2">
              {files.map((file, i) => (
                <li key={i}>📄 {file.name}</li>
              ))}
            </ul>
          )}

          {errorMsg && (
            <p className="text-red-600 text-sm mt-2">Upload error: {errorMsg}</p>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            {uploading ? "Uploading..." : "Upload Statements"}
          </button>

          {uploadSummary && (
            <ResponsiveCard title="Upload Summary">
              <p className="text-sm text-slate-700 mb-2">
                {uploadSummary.totalStatements} statements parsed across {uploadSummary.files.length} file(s).
              </p>
              <ul className="text-sm text-slate-600 space-y-1">
                {uploadSummary.files.map((f, i) => (
                  <li key={i}>✅ {f.filename} ({f.rows} rows)</li>
                ))}
              </ul>
            </ResponsiveCard>
          )}
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
