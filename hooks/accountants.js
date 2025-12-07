const handleReconcile = async ({ id, tag, clientMatch, note }) => {
  try {
    const res = await fetch(`/api/reconciliation/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag, clientMatch, note }),
    });

    if (!res.ok) throw new Error("Reconciliation API failed");

    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: activeClientId,
        user: session?.user?.email || "unknown",
        action: "Reconciled transaction",
        date: new Date().toISOString().split("T")[0],
        details: `Tag: ${tag}, ClientMatch: ${clientMatch}, Note: ${note}`,
      }),
    });

    setAudit(prev => [
      ...prev,
      {
        id: `a_${Date.now()}`,
        clientId: activeClientId,
        user: session?.user?.email || "unknown",
        action: "Reconciled transaction",
        date: new Date().toISOString().split("T")[0],
        details: `Tag: ${tag}, ClientMatch: ${clientMatch}, Note: ${note}`,
      },
    ]);
  } catch (error) {
    console.error("Reconciliation failed:", error);
  }
};
