/**
 * Thin browser wrappers around @simplewebauthn/browser.
 * API calls live in the calling pages (api.webauthnRegister* / api.webauthnLogin*).
 * This module only exposes the ceremony helpers + support checks.
 */
import {
  browserSupportsWebAuthn,
  startRegistration,
  startAuthentication
} from '@simplewebauthn/browser';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser';
import { toast } from 'sonner';

export type { RegistrationResponseJSON, AuthenticationResponseJSON };

export const isWebAuthnSupported = browserSupportsWebAuthn;

/**
 * Start the browser passkey registration ceremony. Returns the JSON response
 * to be sent to the backend for verification, or null if the user cancelled.
 */
export async function startWebAuthnRegistration(
  options: PublicKeyCredentialCreationOptionsJSON
): Promise<RegistrationResponseJSON | null> {
  try {
    return await startRegistration({ optionsJSON: options });
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : String(err);
    if (name === 'NotAllowedError' || name === 'AbortError') return null;
    toast.error('Passkey registration failed. Please try again.');
    return null;
  }
}

/**
 * Start the browser passkey authentication ceremony. Returns the JSON response
 * to be sent to the backend for verification, or null if the user cancelled.
 */
export async function startWebAuthnAuthentication(
  options: PublicKeyCredentialRequestOptionsJSON
): Promise<AuthenticationResponseJSON | null> {
  try {
    return await startAuthentication({ optionsJSON: options });
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : String(err);
    if (name === 'NotAllowedError' || name === 'AbortError') return null;
    toast.error('Passkey authentication failed. Please try again.');
    return null;
  }
}