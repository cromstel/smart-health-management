import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';



export function PasswordChangeModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const canPostpone = user?.role !== 'Super Admin';

  const strength = useMemo(() => {
    const length = newPassword.length >= 8;
    const upper = /[A-Z]/.test(newPassword);
    const lower = /[a-z]/.test(newPassword);
    const number = /[0-9]/.test(newPassword);
    const special = /[^A-Za-z0-9]/.test(newPassword);
    const score = [length, upper, lower, number, special].filter(Boolean).length;
    return { length, upper, lower, number, special, score };
  }, [newPassword]);

  const handleChange = async () => {
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (strength.score < 5) {
      setError('Password does not meet complexity requirements');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully');
      setOpen(false);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Failed to change password';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePostpone = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      interface PostponePasswordChangeResult { remaining: number }
      const result = await api.postponePasswordChange() as PostponePasswordChangeResult
      setSuccess(`Password change postponed. Remaining: ${result.remaining}`)
      setOpen(false)
    } catch (e: any) {
      setError(e.message || 'Failed to postpone')
    } finally {
      setLoading(false);
    }
  };

  if (!user?.password_must_change) return null;

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Change your password</DialogTitle>
          <DialogDescription>
            For security, a password change is required before continuing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              <div>
                Strength: {['Weak', 'Fair', 'Good', 'Strong', 'Excellent'][Math.max(0, strength.score - 1)]}
              </div>
              <div className="flex gap-2 mt-1">
                <span className={strength.length ? 'text-green-600' : 'text-red-600'}>8+ chars</span>
                <span className={strength.upper ? 'text-green-600' : 'text-red-600'}>A–Z</span>
                <span className={strength.lower ? 'text-green-600' : 'text-red-600'}>a–z</span>
                <span className={strength.number ? 'text-green-600' : 'text-red-600'}>0–9</span>
                <span className={strength.special ? 'text-green-600' : 'text-red-600'}>symbol</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}
          {success && <div className="text-sm text-green-600">{success}</div>}
        </div>

        <DialogFooter>
          {canPostpone && (
            <Button variant="outline" onClick={handlePostpone} disabled={loading}>
              Remind me later
            </Button>
          )}
          <Button onClick={handleChange} disabled={loading}>
            {loading ? 'Saving...' : 'Change password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
