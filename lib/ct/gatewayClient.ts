// lib/ct/gatewayClient.ts

import https from "https";

export interface HmrcGatewayClientInput {
  xml: string;               // GovTalkMessage XML
  environment: "test" | "live";
}

/**
 * HMRC Gateway endpoints.
 * Test endpoint is safe and always available.
 */
const HMRC_ENDPOINTS = {
  test: "https://test-transaction-engine.tax.service.gov.uk/submission",
  live: "https://transaction-engine.tax.service.gov.uk/submission",
};

/**
 * Send a GovTalkMessage envelope to HMRC.
 * This is the final step in CT600 filing.
 */
export async function sendToHmrcGateway(
  input: HmrcGatewayClientInput
): Promise<{
  success: boolean;
  statusCode: number;
  body: string;
}> {
  const { xml, environment } = input;

  const endpoint = HMRC_ENDPOINTS[environment];

  return new Promise((resolve, reject) => {
    const req = https.request(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml",
          "Content-Length": Buffer.byteLength(xml),
          "Accept": "text/xml",
        },
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode || 0,
            body: data,
          });
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    req.write(xml);
    req.end();
  });
}
