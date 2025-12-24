import { useState } from "react";

export default function EditableField({ label, value, field, onSave }) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleBlur() {
    if (localValue === value) {
      setEditing(false);
      return;
    }

    setSaving(true);
    await onSave(field, localValue);
    setSaving(false);
    setSaved(true);

    setTimeout(() => setSaved(false), 1200);
    setEditing(false);
  }

  return (
    <div>
      <p className="text-sm text-slate-600">{label}</p>

      {editing ? (
        <input
          className="w-full border rounded px-2 py-1"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          autoFocus
        />
      ) : (
        <p
          className="font-medium text-slate-900 cursor-pointer"
          onClick={() => setEditing(true)}
        >
          {value || "—"}
        </p>
      )}

      {saving && <p className="text-xs text-blue-600">Saving…</p>}
      {saved && <p className="text-xs text-green-600">Saved ✓</p>}
    </div>
  );
}
