import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, ArrowRight, KeyRound } from 'lucide-react';
import { fetchAuth } from '../api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const googleButtonRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await res.json();
      localStorage.setItem('mentor_token', data.token);
      localStorage.setItem('mentor_user', data.user.name);
      onLogin(data.user.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetchAuth('http://localhost:8000/api/auth/set_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      if (!res.ok) throw new Error('Failed to set password');
      
      const savedUser = localStorage.getItem('mentor_user');
      onLogin(savedUser);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (response) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential })
      });
      if (!res.ok) throw new Error('Google Login Failed on Server');
      
      const data = await res.json();
      localStorage.setItem('mentor_token', data.token);
      localStorage.setItem('mentor_user', data.user.name);
      
      if (data.requires_password) {
        setRequiresPassword(true);
      } else {
        onLogin(data.user.name);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requiresPassword) return; // Don't load button if waiting for password

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: "280196074572-8q2p3a92dtiddin028jahplpfe0blnpn.apps.googleusercontent.com",
          callback: handleGoogleSuccess
        });
        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          { theme: "filled_black", size: "large", type: "standard", shape: "rectangular", text: "continue_with" }
        );
        window.google.accounts.id.prompt();
      }
    };
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {}
    };
  }, [requiresPassword]);

  return (
    <div className="flex h-screen bg-[#0d0c0b] text-[#e0d8cd] font-sans items-center justify-center p-8 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#cba36b] rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-[#8a7b6b] rounded-full blur-[100px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="w-full max-w-md bg-[#161311]/80 backdrop-blur-xl border border-[#2a2522] rounded-2xl p-8 shadow-2xl z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#cba36b]/20 to-[#8a7b6b]/5 border border-[#cba36b]/30 mb-4 shadow-lg">
            <span className="text-3xl filter drop-shadow-md">✨</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Mentor AI</h2>
          <p className="text-xs text-[#8a7b6b] uppercase tracking-[0.2em] font-semibold">Plan. Practice. Progress.</p>
        </div>

        <AnimatePresence mode="wait">
          {!requiresPassword ? (
            <motion.div key="login-form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-[#8a7b6b] mb-1.5 uppercase tracking-wide">Email</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-[#cba36b]">
                      <Mail size={16} className="text-[#8a7b6b] group-focus-within:text-[#cba36b] transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0d0c0b] border border-[#2a2522] rounded-xl text-white focus:outline-none focus:border-[#cba36b] focus:ring-1 focus:ring-[#cba36b]/50 transition-all text-sm shadow-inner"
                      placeholder="Enter your email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8a7b6b] mb-1.5 uppercase tracking-wide">Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock size={16} className="text-[#8a7b6b] group-focus-within:text-[#cba36b] transition-colors" />
                    </div>
                    <input
                      type="password"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0d0c0b] border border-[#2a2522] rounded-xl text-white focus:outline-none focus:border-[#cba36b] focus:ring-1 focus:ring-[#cba36b]/50 transition-all text-sm shadow-inner"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs text-center bg-red-400/10 py-2 rounded-lg border border-red-400/20">
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-[#cba36b] to-[#d9ba88] hover:from-[#d9ba88] hover:to-[#e6c999] text-[#0d0c0b] rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <div className="mt-6 mb-6 relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#2a2522]"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-[#161311] text-[#8a7b6b] font-medium">or continue with</span>
                </div>
              </div>

              <div className="flex justify-center w-full min-h-[40px] items-center">
                <div ref={googleButtonRef} className="transition-transform hover:scale-[1.02]"></div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="set-password-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="text-center mb-6">
                <div className="mx-auto w-12 h-12 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mb-3">
                  <KeyRound size={24} />
                </div>
                <h3 className="text-lg font-semibold text-white">Secure Your Account</h3>
                <p className="text-xs text-[#8a7b6b] mt-1">Please set a local password for your account to complete registration.</p>
              </div>

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#8a7b6b] mb-1.5 uppercase tracking-wide">New Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock size={16} className="text-[#8a7b6b] group-focus-within:text-[#cba36b] transition-colors" />
                    </div>
                    <input
                      type="password"
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0d0c0b] border border-[#2a2522] rounded-xl text-white focus:outline-none focus:border-[#cba36b] focus:ring-1 focus:ring-[#cba36b]/50 transition-all text-sm shadow-inner"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs text-center bg-red-400/10 py-2 rounded-lg border border-red-400/20">
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loading || newPassword.length < 6}
                  className="w-full py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <span>{loading ? 'Saving...' : 'Save Password & Continue'}</span>
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
