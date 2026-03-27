import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export function AuthScreen() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');

  return (
    <div className="fixed inset-0 z-[1000] bg-zinc-950 flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-zinc-950 to-purple-950/20" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md mx-4"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40 mb-3">
            <Sparkles size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Backtrack</h1>
          <p className="text-sm text-zinc-500 mt-1">Version control for Ableton Live</p>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/40 p-5 border border-zinc-800/60">
          <div className="flex gap-1 bg-zinc-800/60 rounded-lg p-1 mb-4">
            <button
              onClick={() => setTab('signin')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                tab === 'signin'
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                tab === 'signup'
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Sign up
            </button>
          </div>

          <div className="flex items-center justify-center">
            {tab === 'signin' ? (
              <SignIn
                routing="hash"
                appearance={{
                  variables: { colorPrimary: '#6366f1' },
                  elements: {
                    card: 'shadow-none bg-transparent border-0',
                    headerTitle: 'hidden',
                    headerSubtitle: 'hidden',
                    socialButtonsBlockButton: 'bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700',
                    formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500',
                    formFieldInput: 'bg-zinc-800 border-zinc-700 text-white',
                    footerActionLink: 'text-indigo-400',
                  },
                }}
              />
            ) : (
              <SignUp
                routing="hash"
                appearance={{
                  variables: { colorPrimary: '#6366f1' },
                  elements: {
                    card: 'shadow-none bg-transparent border-0',
                    headerTitle: 'hidden',
                    headerSubtitle: 'hidden',
                    socialButtonsBlockButton: 'bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700',
                    formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500',
                    formFieldInput: 'bg-zinc-800 border-zinc-700 text-white',
                    footerActionLink: 'text-indigo-400',
                  },
                }}
              />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
