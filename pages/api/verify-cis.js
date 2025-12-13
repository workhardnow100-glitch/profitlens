export default function handler(req, res) {
  const { nino } = req.body;
  const valid = /^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$/i.test(nino || "");
  res.json({ registered: valid && !nino.startsWith("ZZ") });
}
