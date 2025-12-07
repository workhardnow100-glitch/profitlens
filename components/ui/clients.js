{/* Manual Transaction Entry */}
<div className="mt-10 mb-8">
  <h3 className="text-lg font-semibold text-slate-700 mb-2">Add Manual Transaction</h3>
  <form
    onSubmit={async e => {
      e.preventDefault();
      if (!selectedClientId || !amount || !type) return;

      setSubmitting(true);
      const res = await fetch("/api/transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          amount: parseFloat(amount),
          type,
          note,
          category,
        }),
      });

      const result = await res.json();
      setSubmitting(false);
      setAmount("");
      setNote("");
      setCategory("");
      mutate("/api/clients/stats");
      alert(result.message || "Transaction added");
    }}
    className="flex flex-col md:flex-row gap-4"
  >
    <select
      value={selectedClientId}
      onChange={e => setSelectedClientId(e.target.value)}
      className="border border-slate-300 rounded px-4 py-2 w-full md:w-1/4"
    >
      <option value="">Select Client</option>
      {data?.clients?.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>

    <input
      type="number"
      value={amount}
      onChange={e => setAmount(e.target.value)}
      placeholder="Amount"
      className="border border-slate-300 rounded px-4 py-2 w-full md:w-1/4"
    />

    <select
      value={type}
      onChange={e => setType(e.target.value)}
      className="border border-slate-300 rounded px-4 py-2 w-full md:w-1/4"
    >
      <option value="">Type</option>
      <option value="revenue">Revenue</option>
      <option value="expense">Expense</option>
    </select>

    <input
      type="text"
      value={note}
      onChange={e => setNote(e.target.value)}
      placeholder="Optional note"
      className="border border-slate-300 rounded px-4 py-2 w-full md:w-1/4"
    />

    <input
      type="text"
      value={category}
      onChange={e => setCategory(e.target.value)}
      placeholder="Category (optional)"
      className="border border-slate-300 rounded px-4 py-2 w-full md:w-1/4"
    />

    <button
      type="submit"
      disabled={submitting}
      className="bg-green-600 text-white px-4 py-2 rounded"
    >
      {submitting ? "Saving..." : "Add Transaction"}
    </button>
  </form>
</div>
