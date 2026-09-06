import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (e) {
      void e
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-600 to-purple-700 overflow-hidden">
      <Card className="w-full max-w-md mx-auto p-8 backdrop-blur-sm bg-white/10 dark:bg-gray-900/20 shadow-lg rounded-lg">
        <CardHeader className="space-y-4">
          <div className="flex flex-col items-center justify-center gap-2 text-white mb-6">
            <img src="/logo.png" alt="Smart Health Manager" className="h-12 w-auto" />
            <h1 className="text-2xl font-bold text-white">Smart Health Manager</h1>
          </div>
          <CardTitle className="text-center text-white text-3xl font-extrabold mb-2">Welcome Back!</CardTitle>
          <CardDescription className="text-center text-gray-200 text-lg">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-medium text-gray-100">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-white/20 border-gray-600 text-white placeholder-gray-300 focus:border-blue-400 focus:ring-blue-400"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <Label htmlFor="password" className="font-medium text-gray-100">Password</Label>
                <Link to="/forgot-password"className="ml-auto inline-block text-sm underline text-blue-200 hover:text-blue-100">
                    Forgot your password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-white/20 border-gray-600 text-white placeholder-gray-300 focus:border-blue-400 focus:ring-blue-400"
              />
            </div>
            <Button type="submit" className="w-full py-2 px-4 rounded-md text-lg font-semibold transition-colors duration-200 bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="mt-6 text-center text-base text-gray-200">
            Don't have an account?{' '}
            <Link to="/signup" className="underline text-blue-200 hover:text-blue-100">
                Sign up
            </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
