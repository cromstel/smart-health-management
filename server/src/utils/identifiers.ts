/**
 * Public identifiers.
 *
 * Several records carry a public identifier — the patient's `PAT-…`, the
 * staff member's `STF-…`, the appointment's `APP-…`. The identifier is
 * unique, and the column it goes into is a unique index, so a collision is a
 * failed write.
 *
 * The identifiers used to be built four times over, and two of the four took
 * the last few digits of the clock. Two records created in the same second
 * asked for the same identifier, and one of them failed with an error the
 * caller could do nothing about. A random token does not collide in practice,
 * and the write retries when it does.
 */

/** The alphabet: no I, O, 0 or 1, so a code read aloud is not misheard. */
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A random identifier of the given length. */
export const randomToken = (length: number): string => {
  let token = '';
  for (let i = 0; i < length; i += 1) {
    token += ID_ALPHABET.charAt(Math.floor(Math.random() * ID_ALPHABET.length));
  }
  return token;
};

/**
 * True when the failure was a collision on a unique index.
 *
 * The collision is expected rather than exceptional, so the write that hit it
 * asks for another identifier and tries again.
 */
export const isDuplicateEntry = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'ER_DUP_ENTRY';
