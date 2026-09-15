import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const smtpUser = process.env.SMTP_USER || process.env.SMTP_USERNAME;
const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
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
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email', { cause: error });
  }
};
