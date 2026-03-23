const nodemailer = require("nodemailer");

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendVerificationCode(email, code) {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
  const appName = process.env.APP_NAME || "ImpactScore";

  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject: `${appName} Email Verification Code`,
    text: `Your ${appName} verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your <strong>${appName}</strong> verification code is:</p><h2>${code}</h2><p>This code expires in 10 minutes.</p>`,
  });

  return { sent: true };
}

module.exports = { sendVerificationCode };
