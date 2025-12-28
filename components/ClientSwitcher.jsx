"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClientSwitcher({ clients, currentClient }) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentClient);

  const handleChange = async (e) => {
    const newClientId = e.target.value;
    setSelected(newClientId);

  await fetch("/api/accountant/switch-client", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ clientId: newClientId }),
});

// ⭐ THIS is the missing piece — forces NextAuth to reload the session
await fetch("/api/auth/session?update=1");

router.refresh();

  };

  // If only one client, no need to show switcher
  if (!clients || clients.length <= 1) return null;

  return (
    <div className="p-3 border rounded bg-white shadow-sm mb-4">
      <label className="block text-sm font-medium mb-1">Acting as:</label>

      <select
        value={selected || ""}
        onChange={handleChange}
        className="w-full border p-2 rounded"
      >
        {clients.map((c) => (
          <option key={c.client_id} value={c.client_id}>
            {c.business_name || c.name || c.email}
          </option>
        ))}
      </select>
    </div>
  );
}

