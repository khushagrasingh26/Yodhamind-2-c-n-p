'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Note: Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Auth() {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // You can customize the redirect URL based on your environment
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      console.error('Error signing in with Google:', err);
      setError(err.message || 'An error occurred during sign in.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#050505] text-white font-sans p-4">
      {/* Main Container */}
      <div className="w-full max-w-sm p-8 rounded-3xl bg-[#0a0a0a] border border-white/5 shadow-2xl relative overflow-hidden group">
        
        {/* Subtle neon glow effect on hover */}
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-1000 pointer-events-none" />

        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-light tracking-tight text-white mb-2">Welcome</h1>
            <p className="text-sm text-white/40">Access your account to continue</p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-white/5 rounded-full p-1 mb-8">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 text-sm font-medium py-2.5 rounded-full transition-all duration-300 ${
                activeTab === 'login'
                  ? 'bg-[#1a1a1a] text-white shadow-sm border border-white/10'
                  : 'text-white/40 hover:text-white/70 border border-transparent'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 text-sm font-medium py-2.5 rounded-full transition-all duration-300 ${
                activeTab === 'signup'
                  ? 'bg-[#1a1a1a] text-white shadow-sm border border-white/10'
                  : 'text-white/40 hover:text-white/70 border border-transparent'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Authentication Action */}
          <div className="mt-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="group/btn relative w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-[#141414] border border-white/10 rounded-2xl overflow-hidden transition-all duration-500 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Glow behind button */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
              
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin relative z-10" />
              ) : (
                <svg className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover/btn:scale-110" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span className="text-sm font-medium text-white/90 relative z-10 transition-colors duration-300 group-hover/btn:text-white">
                Continue with Google
              </span>
            </button>
          </div>

          {error && (
            <p className="mt-4 text-xs text-red-500/90 text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}

          {/* Footer terms */}
          <div className="mt-8 text-center">
            <p className="text-xs text-white/30 leading-relaxed gap-1">
              By continuing, you agree to our <br/>
              <a href="#" className="underline decoration-white/20 hover:decoration-white/60 hover:text-white/60 transition-colors">Terms of Service</a> &middot; <a href="#" className="underline decoration-white/20 hover:decoration-white/60 hover:text-white/60 transition-colors">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
