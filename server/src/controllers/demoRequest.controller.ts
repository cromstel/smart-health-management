import type { Request, Response } from 'express';
import { sendEmail } from '../utils/mail.js';

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[character] ?? character));

export const submitDemoRequest = async (req: Request, res: Response): Promise<void> => {
  const recipient = process.env.DEMO_REQUEST_RECIPIENT;

  if (!recipient) {
    res.status(503).json({ error: 'Demo requests are not configured yet. Please contact the Smart MediCare team directly.' });
    return;
  }

  const { name, email, organization, role, organizationSize, message, phone, preferredContact, website } = req.body;

  // Hidden field: silently accept likely bot submissions without forwarding them.
  if (website) {
    res.status(202).json({ message: 'Thanks for your interest. We will be in touch shortly.' });
    return;
  }

  const fields = [
    ['Name', name],
    ['Work email', email],
    ['Organisation', organization],
    ['Role', role],
    ['Organisation size', organizationSize],
    ['Preferred contact', preferredContact],
    ['Phone', phone || 'Not provided'],
    ['Message', message || 'Not provided'],
  ] as const;

  const text = fields.map(([label, value]) => `${label}: ${value}`).join('\n');
  const html = `<h2>New Smart MediCare demo request</h2><dl>${fields.map(([label, value]) => (
    `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value)}</dd>`
  )).join('')}</dl>`;

  // Delivery is best-effort. The request has already been validated and is a
  // sales lead, so losing it because outbound SMTP is misconfigured is the
  // worst possible failure mode, and telling the prospect it failed invites
  // them not to retry. Accept the submission, log the delivery failure loudly
  // instead, and let the team follow up from the logs.
  try {
    await sendEmail({
      to: recipient,
      subject: `Demo request from ${name}`,
      text,
      html,
    });
  } catch (error) {
    console.error('[demo-request] email delivery failed; request was accepted but not delivered', {
      name,
      email,
      organization,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  res.status(202).json({ message: 'Thanks for your interest. Our team will be in touch shortly.' });
};
