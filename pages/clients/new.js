'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function NewClientPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [form, setForm] = useState({ name: '', amount: '', type: 'revenue' });
  const [status, setStatus] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    const name = form.name.trim();
    const amount = parseFloat(form.amount);
    const type = form.type;

    if (!name || isNaN(amount)) {
      setStatus('Please enter a valid name and amount.');
      return;
    }

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount,
          type,
          email: session?.user?.email || '',
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Submission failed');

      setForm({ name: '', amount: '', type: 'revenue' });
      setStatus('Client entry added successfully.');
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to submit client:', err);
      setStatus('Submission failed.');
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Add New Client Entry</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Client Name"
          required
          className="w-full border px-4 py-2 rounded"
        />
        <input
          name="amount"
          value={form.amount}
          onChange={handleChange}
          placeholder="Amount"
          type="number"
          step="0.01"
          required
          className="w-full border px-4 py-2 rounded"
        />
        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          required
          className="w-full border px-4 py-2 rounded"
        >
          <option value="revenue">Revenue</option>
          <option value="expense">Expense</option>
        </select>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Entry
        </button>
      </form>
      {status && <p className="text-sm text-slate-600 mt-2">{status}</p>}
    </div>
  );
}
