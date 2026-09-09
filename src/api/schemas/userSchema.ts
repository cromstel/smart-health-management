import * as z from 'zod';

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  hospital_id: z.string().optional(),
  status: z.string().optional(),
});

export const userListSchema = z.array(userSchema);

export type UserProfile = z.infer<typeof userSchema>;
