// services/ipfs.js
// Uploads files to IPFS via Pinata's pinning service.
// Falls back to a mock CID for local development.

const https = require("https");
require("dotenv").config();

const PINATA_BASE = "https://api.pinata.cloud";

function hasPinataCredentials() {
  return Boolean(
    process.env.PINATA_JWT ||
    (process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET),
  );
}

function getPinataHeaders(boundary, bodyLength) {
  const headers = {
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": bodyLength,
  };

  if (process.env.PINATA_JWT) {
    headers.Authorization = `Bearer ${process.env.PINATA_JWT}`;
    return headers;
  }

  if (process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET) {
    headers.pinata_api_key = process.env.PINATA_API_KEY;
    headers.pinata_secret_api_key = process.env.PINATA_API_SECRET;
    return headers;
  }

  return headers;
}

/**
 * Upload a Buffer to IPFS.
 * @param {Buffer} buffer    File data
 * @param {string} filename  Original filename (for metadata)
 * @returns {string} IPFS CID (e.g. QmXyz...)
 */
async function uploadBuffer(buffer, filename = "document") {
  if (!hasPinataCredentials()) {
    // Development mock — return a deterministic fake CID
    const crypto = require("crypto");
    const fakeCid =
      "Qm" +
      crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 44);
    console.warn(
      "[IPFS] Pinata credentials not set — using mock CID:",
      fakeCid,
    );
    return fakeCid;
  }

  // Build multipart/form-data manually (no heavy deps)
  const boundary = "----ImpactScoreBoundary" + Date.now();
  const chunks = [];

  // File part
  chunks.push(
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`,
    ),
  );
  chunks.push(buffer);
  chunks.push(Buffer.from("\r\n"));

  // Metadata part
  const metadata = JSON.stringify({ name: filename });
  chunks.push(
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="pinataMetadata"\r\n\r\n` +
        metadata +
        "\r\n",
    ),
  );

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);

  const cid = await new Promise((resolve, reject) => {
    const options = {
      hostname: "api.pinata.cloud",
      path: "/pinning/pinFileToIPFS",
      method: "POST",
      headers: getPinataHeaders(boundary, body.length),
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.IpfsHash) resolve(json.IpfsHash);
          else reject(new Error("Pinata error: " + data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });

  return cid;
}

/**
 * Returns the IPFS gateway URL for a CID.
 */
function gatewayUrl(cid) {
  const base =
    process.env.IPFS_GATEWAY_BASE || "https://gateway.pinata.cloud/ipfs";
  return `${base.replace(/\/$/, "")}/${cid}`;
}

module.exports = { uploadBuffer, gatewayUrl, hasPinataCredentials };
