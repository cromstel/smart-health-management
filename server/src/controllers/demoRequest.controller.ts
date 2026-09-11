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
    res.status(503).json({ error: 'Demo requests are not configured yet. Please contact the Smart Health team directly.' });
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
  const html = `<h2>New Smart Health demo request</h2><dl>${fields.map(([label, value]) => (
    `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value)}</dd>`
  )).join('')}</dl>`;

  try {
    await sendEmail({
      to: recipient,
      subject: `Demo request from ${name}`,
      text,
      html,
    });
    res.status(202).json({ message: 'Thanks for your interest. Our team will be in touch shortly.' });
  } catch {
    res.status(502).json({ error: 'We could not send your request right now. Please try again later.' });
  }
};
