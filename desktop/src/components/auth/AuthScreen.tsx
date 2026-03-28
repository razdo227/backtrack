import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { useAppStore } from '../../store/appStore';

type Tab = 'signin' | 'signup';

export function AuthScreen() {
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const { projectsFolder, setScreen } = useAppStore();

  const navigateAfterAuth = () => {
    setScreen(projectsFolder ? 'main' : 'setup');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signIn) return;
    setError(null);
    setIsLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        navigateAfterAuth();
      } else {
        setError('Sign in incomplete. Check your email for a verification link.');
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    setError(null);
    setIsLoading(true);
    try {
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
        navigateAfterAuth();
      } else {
        // Needs email verification
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setSuccessMsg('Check your email for a verification code — then sign in.');
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-zinc-950 flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-zinc-950 to-purple-950/20" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-sm mx-4"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40 mb-3">
            <Sparkles size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Backtrack</h1>
          <p className="text-sm text-zinc-500 mt-1">Version control for Ableton Live</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/40 p-6 border border-zinc-800/60">
          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-800/60 rounded-lg p-1 mb-5">
            {(['signin', 'signup'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  tab === t ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {successMsg ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-6"
            >
              <div className="text-4xl mb-3">✉️</div>
              <p className="text-sm text-zinc-300">{successMsg}</p>
            </motion.div>
          ) : (
            <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-3">
              {/* Email */}
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/60 focus:border-indigo-500/60 transition"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/60 focus:border-indigo-500/60 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-400 bg-red-950/40 rounded-lg px-3 py-2"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : tab === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          )}
        </div>

        {/* Skip */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setScreen(projectsFolder ? 'main' : 'setup')}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition"
          >
            Skip for now →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
