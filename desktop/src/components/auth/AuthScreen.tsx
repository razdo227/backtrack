import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { useAppStore } from '../../store/appStore';

type Tab = 'signin' | 'signup';

// Bring keyboard focus to the window when the auth screen mounts.
// Required for macOS menubar (Accessory policy) apps where the OS may not
// automatically deliver keyboard events to the newly-shown window.
async function focusWindow() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setFocus();
  } catch {
    // Not running inside Tauri (e.g. browser dev preview) – ignore.
  }
}

export function AuthScreen() {
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const { projectsFolder, setScreen, setAuthSkipped } = useAppStore();

  // Ensure keyboard focus lands in the window (macOS Accessory-policy apps).
  useEffect(() => {
    focusWindow();
  }, []);

  // If Clerk hasn't loaded after 6 s, surface a warning so the user
  // knows why the form buttons appear unresponsive.
  useEffect(() => {
    if (signInLoaded) return;
    const timer = setTimeout(() => setClerkTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, [signInLoaded]);

  const navigateAfterAuth = () => {
    setScreen(projectsFolder ? 'main' : 'setup');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signIn) {
      setError('Authentication service is not available. Check your network connection or use "Skip for now" below.');
      return;
    }
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
    if (!signUpLoaded || !signUp) {
      setError('Authentication service is not available. Check your network connection or use "Skip for now" below.');
      return;
    }
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

  const clerkReady = signInLoaded && signUpLoaded;

  return (
    <div className="fixed inset-0 z-[1000] bg-zinc-950 flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-zinc-950 to-purple-950/20 pointer-events-none" />

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

        {/* Clerk not available warning */}
        {clerkTimedOut && !clerkReady && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 bg-amber-950/50 border border-amber-800/50 rounded-xl px-3 py-2.5 mb-3"
          >
            <AlertCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300 leading-relaxed">
              Auth service unavailable — check your network. You can still use the app by clicking <strong>Skip for now</strong>.
            </p>
          </motion.div>
        )}

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
                ) : !clerkReady ? (
                  <>
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {tab === 'signin' ? 'Sign in' : 'Create account'}
                  </>
                ) : tab === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          )}
        </div>

        {/* Skip */}
        <div className="mt-4 text-center">
          <button
            onClick={() => { setAuthSkipped(true); setScreen(projectsFolder ? 'main' : 'setup'); }}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition"
          >
            Skip for now →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
