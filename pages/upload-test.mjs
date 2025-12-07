import fs from "fs";
import path from "path";
import FormData from "form-data";

const filePath = path.join(path.dirname(new URL(import.meta.url).pathname), "test.csv");

const form = new FormData();
form.append("files", fs.createReadStream(filePath));

// Replace with real IDs from your app_users row
form.append("userId", "ceaeb1b2-7d95-4429-a5f7-a73ec3804b09");
form.append("clientId", "YOUR-CLIENT-ID-HERE");
form.append("email", "workhardnow100@gmail.com");

fetch("http://localhost:3000/api/upload/bulk", {
  method: "POST",
  body: form,
  headers: {
    ...form.getHeaders(),
  },
})
  .then(async (res) => {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      console.log("✅ Upload success:", data);
    } catch (err) {
      console.error("❌ Server returned non-JSON:", text);
    }
  })
  .catch((err) => {
    console.error("❌ Upload failed:", err);
  });
