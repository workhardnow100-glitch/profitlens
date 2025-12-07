import React, { useState, useEffect } from "react";
import { uploadStatement, listStatements, getStatementUrl } from "../lib/storageClient";

export default function UploadStatement({ user }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [files, setFiles] = useState([]);
  const [urls, setUrls] = useState({}); // { path: signedUrl }

  const refreshList = async () => {
    try {
      setError("");
      const entries = await listStatements(user);
      setFiles(entries || []);
    } catch (e) {
      setError(e.message || "Failed to list statements");
      setFiles([]);
    }
  };

  useEffect(() => {
    if (user?.clientId) refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.clientId]);

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setSuccess("");
    setError("");
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a file first.");
      return;
    }
    if (!user?.clientId) {
      setError("User not available.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const result = await uploadStatement(file, user);
      setSuccess(`Uploaded: ${result?.path || file.name}`);
      setFile(null);
      await refreshList();
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleGetUrl = async (path) => {
    try {
      const signedUrl = await getStatementUrl(path);
      setUrls((prev) => ({ ...prev, [path]: signedUrl }));
    } catch (e) {
      setError(e.message || "Failed to create signed URL");
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <form onSubmit={handleUpload} style={{ display: "grid", gap: 8 }}>
        <input
          type="file"
          onChange={handleFileChange}
          accept=".csv,.pdf,.xlsx,.xls,.ofx,.qif,.txt"
          disabled={uploading}
        />
        <button type="submit" disabled={uploading || !file}>
          {uploading ? "Uploading…" : "Upload statement"}
        </button>
      </form>

      {error && <div style={{ color: "crimson" }}>{error}</div>}
      {success && <div style={{ color: "seagreen" }}>{success}</div>}

      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Your statements</div>
        <button onClick={refreshList} style={{ marginBottom: 8 }}>
          Refresh
        </button>
        {files.length === 0 ? (
          <div>No files yet.</div>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {files.map((f) => {
              const path = `statements/${user.clientId}/${f.name}`; // ✅ clientId scoping
              return (
                <li key={path} style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>{f.name}</span>
                    <span style={{ color: "#666" }}>
                      {f.metadata?.size ? `(${f.metadata.size} bytes)` : ""}
                    </span>
                    <button onClick={() => handleGetUrl(path)}>Get signed URL</button>
                    {urls[path] && (
                      <a href={urls[path]} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
