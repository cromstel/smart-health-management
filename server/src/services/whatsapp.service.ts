// env.ts must be imported before anything reads process.env; it is the first
// import so ESM evaluation order guarantees it runs first.
import '../config/env.js';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Lazy for the same reason as utils/sms.ts: the Twilio constructor throws on a
// placeholder or absent account SID, which would otherwise abort API startup.
let client: ReturnType<typeof twilio> | null = null;

const getClient = (): ReturnType<typeof twilio> => {
  if (client) return client;
  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    throw new Error(
      'Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to send WhatsApp messages.'
    );
  }
  client = twilio(accountSid, authToken);
  return client;
};

export const sendWhatsAppMessage = async (to: string, body: string) => {
  try {
    await getClient().messages.create({
      body,
      from: `whatsapp:${twilioPhoneNumber}`,
      to: `whatsapp:${to}`,
    });
    console.log(`WhatsApp message sent to ${to}`);
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
};
