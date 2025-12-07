import fs from "fs";
import path from "path";
import FormData from "form-data";
import { fileURLToPath } from "url";

// Resolve file path relative to this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, "test.csv");

const form = new FormData();
form.append("files", fs.createReadStream(filePath));

const clientId = "workhardnow100@gmail.com"; // ✅ Replace with dynamic arg if needed

fetch("http://localhost:3000/api/upload/bulk", {
  method: "POST",
  body: form,
  headers: {
    "x-client-id": clientId,
    ...form.getHeaders(),
  },
})
  .then(async res => {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      console.log("✅ Upload success:", data);
    } catch (err) {
      console.error("❌ Server returned non-JSON:", text);
    }
  })
  .catch(err => {
    console.error("❌ Upload failed:", err.message);
  });
