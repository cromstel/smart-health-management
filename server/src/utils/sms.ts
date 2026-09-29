// env.ts must be imported before anything reads process.env; it is the first
// import so ESM evaluation order guarantees it runs first.
import '../config/env.js';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

/**
 * Built lazily rather than at import time.
 *
 * The Twilio SDK validates the account SID in its constructor and throws
 * "accountSid must start with AC" for a placeholder or absent value, so
 * constructing the client at module scope meant one optional integration's
 * config took the whole API down at boot, before any route could serve. SMS is
 * one feature among many and should not be able to do that.
 */
let client: ReturnType<typeof twilio> | null = null;

const getClient = (): ReturnType<typeof twilio> => {
  if (client) return client;
  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    throw new Error(
      'Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to send SMS.'
    );
  }
  client = twilio(accountSid, authToken);
  return client;
};

export const sendSms = async (to: string, body: string) => {
  try {
    await getClient().messages.create({
      body,
      from: twilioPhoneNumber,
      to,
    });
    console.log('SMS sent successfully');
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw new Error('Failed to send SMS', { cause: error });
  }
};