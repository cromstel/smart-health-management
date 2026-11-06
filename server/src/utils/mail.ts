import nodemailer from 'nodemailer';
// env.ts is imported first so process.env is populated before anything below
// reads it; the old bare dotenv.config() here only ever saw the CWD.
import '../config/env.js';
import { APP_NAME } from '../config/app.js';
import { isConfigured } from '../config/env.js';

const smtpUser = process.env.SMTP_USER || process.env.SMTP_USERNAME;
const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  // The port is configuration. Left unset, the mailer applies the submission
  // port its own transport standardises on.
  ...(process.env.SMTP_PORT ? { port: Number(process.env.SMTP_PORT) } : {}),
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
});

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const sendEmail = async (options: MailOptions) => {
  try {
    // A placeholder is not an SMTP host. The environment files carry one for
    // every integration that is not switched on, and connecting to it would
    // fail with a DNS error instead of saying what is actually missing.
    if (!isConfigured(process.env.SMTP_HOST)) {
      throw new Error('Email is not configured: set SMTP_HOST, SMTP_PORT and SMTP_USERNAME / SMTP_PASSWORD');
    }
    if (!smtpUser || !smtpPass) {
      throw new Error('Email is not configured: set SMTP_USERNAME (or SMTP_USER) and SMTP_PASSWORD (or SMTP_PASS)');
    }

    // The sender is "Name <address>". The display name is configuration, and
    // the product name is the fallback: the environment used to carry the
    // literal text "${APP_NAME}", which nothing expands, so that text would
    // have gone out on every message.
    const fromAddress = process.env.EMAIL_FROM;
    const fromName = (process.env.MAIL_FROM_NAME || APP_NAME).trim();
    const replyTo = process.env.SMTP_REPLY_TO?.trim() || fromAddress;

    const mailOptions = {
      from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      ...(replyTo ? { replyTo } : {}),
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email', { cause: error });
  }
};
