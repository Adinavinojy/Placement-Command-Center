import React, { useState, useEffect } from 'react';
import { Moon, Sun, Key, Download, Trash2, LogOut, X, Book } from 'lucide-react';
import { fetchAuth } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export default function SettingsView({ onLogout, onUpdate, theme, setTheme }) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Password Modal State
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);
  
  // User Manual State
  const [userManual, setUserManual] = useState('');

  useEffect(() => {
    fetchAuth(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/manual`)
      .then(r => r.json())
      .then(d => { if (d.content) setUserManual(d.content); })
      .catch(e => console.error("Failed to fetch manual", e));
  }, []);

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('mentor_token');
      // Append token as a query param since we are using window.location.href
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/export?token=${token}`;
    } catch (e) {
      console.error('Failed to export data', e);
    }
  };

  const handleClearData = async () => {
    if (window.confirm("WARNING: This will delete ALL your uploaded documents, generated plans, and profile data! Are you absolutely sure you want to start as a clean slate?")) {
      try {
        const res = await fetchAuth(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/profile/data`, { method: 'DELETE' });
        if (res.ok) {
          window.location.reload();
        } else {
          alert("Failed to clear data.");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("CRITICAL WARNING: This will PERMANENTLY delete your account, login ID, password, and ALL data. This action cannot be undone. Type 'DELETE' in the next prompt to confirm.")) {
      const confirmText = window.prompt("Type DELETE to permanently delete your account:");
      if (confirmText === "DELETE") {
        try {
          const res = await fetchAuth(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/profile/account`, { method: 'DELETE' });
          if (res.ok) {
            onLogout();
          } else {
            alert("Failed to delete account.");
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    setIsChangingPwd(true);

    try {
      const res = await fetchAuth(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/auth/change_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to change password');
      }

      setPwdSuccess("Password updated successfully!");
      setCurrentPwd('');
      setNewPwd('');
      setTimeout(() => setShowPwdModal(false), 2000);
    } catch (err) {
      setPwdError(err.message);
    } finally {
      setIsChangingPwd(false);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col h-full text-[#e0d8cd] relative">
      <div className="mb-8">
        <h2 className="text-2xl font-medium text-[#e0d8cd]">Settings</h2>
        <p className="text-sm text-[#8a7b6b] mt-1">Manage your account and local data</p>
      </div>

      <div className="max-w-3xl space-y-8">
        {/* Appearance */}
        <section className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            Appearance
          </h3>
          <div className="flex items-center justify-between p-4 bg-[#0d0c0b] rounded-xl border border-[#2a2522]">
            <div>
              <p className="font-medium text-[#e0d8cd]">Theme</p>
              <p className="text-xs text-[#8a7b6b]">Choose your preferred visual style</p>
            </div>
            <div className="flex space-x-2 bg-[#161311] p-1 rounded-lg border border-[#2a2522]">
              <button 
                onClick={() => setTheme('light')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'light' ? 'bg-[#cba36b] text-[#0d0c0b]' : 'text-[#8a7b6b] hover:text-[#e0d8cd]'}`}
              >
                <Sun size={14} /> <span>Light</span>
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-[#cba36b] text-[#0d0c0b]' : 'text-[#8a7b6b] hover:text-[#e0d8cd]'}`}
              >
                <Moon size={14} /> <span>Dark</span>
              </button>
            </div>
          </div>
        </section>

        {/* Account */}
        <section className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            Account
          </h3>
          <div className="space-y-3">
            <button 
              onClick={() => { setShowPwdModal(true); setPwdError(''); setPwdSuccess(''); }}
              className="w-full flex items-center justify-between p-4 bg-[#0d0c0b] rounded-xl border border-[#2a2522] hover:border-[#cba36b]/50 transition-colors text-left group"
            >
              <div>
                <p className="font-medium text-[#e0d8cd] group-hover:text-[#cba36b] transition-colors">Change Password</p>
                <p className="text-xs text-[#8a7b6b]">Update your account security (Local)</p>
              </div>
              <Key size={16} className="text-[#8a7b6b]" />
            </button>
            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-between p-4 bg-[#0d0c0b] rounded-xl border border-[#2a2522] hover:border-[#cba36b]/50 transition-colors text-left group"
            >
              <div>
                <p className="font-medium text-[#e0d8cd] group-hover:text-[#cba36b] transition-colors">Log Out</p>
                <p className="text-xs text-[#8a7b6b]">Sign out of your current session</p>
              </div>
              <LogOut size={16} className="text-[#8a7b6b]" />
            </button>
            <button 
              onClick={handleClearData}
              className="w-full flex items-center justify-between p-4 bg-[#0d0c0b] rounded-xl border border-[#2a2522] hover:border-orange-500/50 transition-colors text-left group"
            >
              <div>
                <p className="font-medium text-[#e0d8cd] group-hover:text-orange-400 transition-colors">Clear All Data</p>
                <p className="text-xs text-[#8a7b6b]">Wipes your vault and resets profile (Keeps account login)</p>
              </div>
              <Trash2 size={16} className="text-orange-400 opacity-50 group-hover:opacity-100" />
            </button>
            <button 
              onClick={handleDeleteAccount}
              className="w-full flex items-center justify-between p-4 bg-red-950/20 rounded-xl border border-red-900/30 hover:border-red-500/50 transition-colors text-left group"
            >
              <div>
                <p className="font-medium text-red-400 group-hover:text-red-300 transition-colors">Permanently Delete Account</p>
                <p className="text-xs text-red-500/70">Deletes everything including login credentials. Cannot be undone.</p>
              </div>
              <Trash2 size={16} className="text-red-500 opacity-50 group-hover:opacity-100" />
            </button>
          </div>
        </section>

        {/* Data Management */}
        <section className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            Data Management
          </h3>
          <div className="space-y-3">
            <button 
              onClick={handleExport}
              className="w-full flex items-center justify-between p-4 bg-[#0d0c0b] rounded-xl border border-[#2a2522] hover:border-[#cba36b]/50 transition-colors text-left group"
            >
              <div>
                <p className="font-medium text-[#e0d8cd] group-hover:text-[#cba36b] transition-colors">Export Data</p>
                <p className="text-xs text-[#8a7b6b]">Download your local study plan and documents as a ZIP</p>
              </div>
              <Download size={16} className="text-[#8a7b6b]" />
            </button>
          </div>
        </section>

        {/* User Manual */}
        <section className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <Book size={18} className="mr-2 text-[#cba36b]" />
            User Manual
          </h3>
          <div className="bg-[#0d0c0b] p-6 rounded-xl border border-[#2a2522] prose prose-invert max-w-none text-sm text-[#e0d8cd] leading-relaxed custom-scrollbar max-h-[600px] overflow-y-auto">
            {userManual ? (
              <ReactMarkdown>{userManual}</ReactMarkdown>
            ) : (
              <p className="text-[#8a7b6b]">Loading User Manual...</p>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showPwdModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 w-full max-w-sm relative"
            >
              <button 
                onClick={() => setShowPwdModal(false)}
                className="absolute top-4 right-4 text-[#8a7b6b] hover:text-white"
              >
                <X size={20} />
              </button>
              <h3 className="text-xl font-bold mb-4">Change Password</h3>
              
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#8a7b6b] mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    className="w-full px-3 py-2 bg-[#0d0c0b] border border-[#2a2522] rounded-xl text-[#e0d8cd] focus:outline-none focus:border-[#cba36b] text-sm"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8a7b6b] mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 bg-[#0d0c0b] border border-[#2a2522] rounded-xl text-[#e0d8cd] focus:outline-none focus:border-[#cba36b] text-sm"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                  />
                </div>

                {pwdError && <p className="text-red-400 text-xs">{pwdError}</p>}
                {pwdSuccess && <p className="text-green-400 text-xs">{pwdSuccess}</p>}

                <button
                  type="submit"
                  disabled={isChangingPwd || currentPwd === '' || newPwd.length < 6}
                  className="w-full py-2 bg-[#cba36b] hover:bg-[#d9ba88] text-[#0d0c0b] rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {isChangingPwd ? 'Saving...' : 'Update Password'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
