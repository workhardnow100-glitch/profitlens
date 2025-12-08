// pages/upload.js
import React, { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/router";
import Layout from "../components/layout";
import { getSession } from "next-auth/react";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Upload() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [sessionUser, setSessionUser] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const { data, error } = useSWR("/api/stats", fetcher);
  const router = useRouter();

  // 🔑 Load session and enforce access
  useEffect(() => {
    const loadSession = async () => {
      const session = await getSession();
      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const { role, subscriptionStatus, clientId, email, id } = session.user;

      const isAdmin = role === "admin";
      const isSubscribed = ["basic", "pro"].includes(subscriptionStatus);

      if (!(isAdmin || isSubscribed)) {
        router.replace("/upgrade");
        return;
      }

      setSessionUser({ id, email, clientId, role, subscriptionStatus });
    };

    loadSession();
  }, [router]);

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

    // Pass identifiers so API can scope correctly
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

      mutate("/api/stats");
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
    <Layout currentPageName="Upload">
      <div className="p-8">
        <h2 className="text-2xl font-bold text-slate-800">Upload Statements</h2>
        <p className="text-slate-600 mt-2">
          Upload your bank statements here to begin analysis. Supported formats include CSV and Excel.
          Once uploaded, your data will be parsed and tagged automatically.Either use bulk processing 
          or uploads, for open banking use bulk processing.
        </p>

        <div className="mt-6 space-y-4">
          <input
            type="file"
            multiple
            accept=".csv,.xlsx"
            onChange={(e) => setFiles(Array.from(e.target.files))}
            className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />

          {files.length > 0 && (
            <ul className="text-sm text-slate-700 space-y-1">
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            {uploading ? "Uploading..." : "Upload Statements"}
          </button>

          {uploadSummary && (
            <div className="mt-6 bg-white/70 border rounded p-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Upload Summary</h3>
              <p className="text-sm text-slate-700 mb-2">
                {uploadSummary.totalStatements} statements parsed across {uploadSummary.files.length} file(s).
              </p>
              <ul className="text-sm text-slate-600 space-y-1">
                {uploadSummary.files.map((f, i) => (
                  <li key={i}>✅ {f.filename} ({f.rows} rows)</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white shadow rounded p-4 text-center">
              <h3 className="text-sm font-medium text-slate-500">Year Profit</h3>
              <p className="text-xl font-bold text-slate-800 mt-2">
                {error ? "—" : data?.yearProfit}
              </p>
            </div>

            <div className="bg-white shadow rounded p-4 text-center">
              <h3 className="text-sm font-medium text-slate-500">Monthly Revenue</h3>
              <p className="text-xl font-bold text-slate-800 mt-2">
                {error ? "—" : data?.monthlyRevenue}
              </p>
            </div>

            <div className="bg-white shadow rounded p-4 text-center">
              <h3 className="text-sm font-medium text-slate-500">Monthly Expenses</h3>
              <p className="text-xl font-bold text-slate-800 mt-2">
                {error ? "—" : data?.monthlyExpenses}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
