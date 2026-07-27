import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Calendar as CalendarIcon, BarChart2, BookOpen, Folder, Target, TrendingUp, FileText, Settings, Search, Bell, Plus, CheckCircle, Send, Play, ChevronRight, ChevronLeft, X, Trash2, Briefcase, RefreshCw, Download, Save, Edit2, AlertTriangle, FileSearch } from 'lucide-react';
import Onboarding from './components/Onboarding';
import Assessment from './components/Assessment';
import CalendarView from './components/CalendarView';
import DocumentsView from './components/DocumentsView';
import NotesView from './components/NotesView';
import SettingsView from './components/SettingsView';
import MistakesView from './components/MistakesView';
import ResumeATS from './components/ResumeATS';
import Login from './components/Login';
import ReactMarkdown from 'react-markdown';
import './index.css';

import { motion, AnimatePresence } from 'framer-motion';
import { fetchAuth, API_BASE } from './api';

const SidebarItem = ({ icon: Icon, text, active = false, onClick, disabled = false, onDisabledClick }) => (
  <div onClick={disabled ? onDisabledClick : onClick} className={`flex items-center space-x-4 px-6 py-3 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${active && !disabled ? 'bg-[#1e1916] border-l-2 border-[#cba36b] text-[#cba36b]' : disabled ? 'text-gray-500' : 'text-gray-400 hover:text-[#e0d8cd] hover:bg-[#161311]'}`}>
    <Icon size={18} className={active && !disabled ? "text-[#cba36b]" : "text-gray-500"} />
    <span className="font-medium text-sm tracking-wide">{text}</span>
  </div>
);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('mentor_token');
  });
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('mentor_user') || null;
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [activeTab, setActiveTab] = useState('AI Chat');
  const [profile, setProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', text: "Share your schedule, goals, or any document with me.\nI'll help you plan better and stay on track.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentsList, setDocumentsList] = useState({});
  const [openDocCategories, setOpenDocCategories] = useState({ 'General': true });
  const [studyPlan, setStudyPlan] = useState([]);
  const [planVersions, setPlanVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null); // null = latest
  const [toastMessage, setToastMessage] = useState("");
  const [careerReview, setCareerReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [academicProfile, setAcademicProfile] = useState({ tenth: "", twelfth: "", cgpa: "", sgpas: "" });
  const [isEditingScores, setIsEditingScores] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState({ is_locked: false, has_profile: true });
  const [globalEvalStatus, setGlobalEvalStatus] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAuth(`${API_BASE}/api/academic_profile`)
      .then(r => r.json())
      .then(d => {
        if (d.tenth !== undefined) {
          setAcademicProfile(d);
          setIsEditingScores(false); // Lock the form if data exists
        }
      })
      .catch(e => console.error(e));

    fetchAuth(`${API_BASE}/api/improvement_review/saved`)
      .then(r => r.json())
      .then(d => {
        if (d.review) setCareerReview(d.review);
      })
      .catch(e => console.error(e));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Always refresh dashboard data when switching tabs so skills/deadlines are fresh
    fetchAuth(`${API_BASE}/api/dashboard`)
      .then(res => res.json())
      .then(data => setDashboardData(data))
      .catch(err => console.error("Error refreshing dashboard data", err));

    // Fetch study plan unconditionally so it's available for the sidebar widget
    fetchAuth(`${API_BASE}/api/study_plan`)
      .then(res => res.json())
      .then(data => {
        if (data.plan && Array.isArray(data.plan)) {
          setStudyPlan(data.plan);
        }
      })
      .catch(err => console.error("Error fetching study plan", err));

    if (activeTab === 'Study Plan') {
      setSelectedVersion(null);
      // Also fetch version history
      fetchAuth(`${API_BASE}/api/study_plan/versions`)
        .then(res => res.json())
        .then(data => { if (data.versions) setPlanVersions(data.versions); })
        .catch(() => { });
    }
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === 'Documents' || activeTab === 'Generated Docs') {
      fetchAuth(`${API_BASE}/api/documents`)
        .then(res => res.json())
        .then(data => {
          if (data.documents) {
            setDocumentsList(data.documents);
            // Open all categories by default
            const initialOpenState = {};
            Object.keys(data.documents).forEach(k => initialOpenState[k] = true);
            setOpenDocCategories(initialOpenState);
          }
        })
        .catch(err => console.error("Error fetching docs", err));
    }
  }, [activeTab, isAuthenticated]);

  const toggleDocCategory = (category) => {
    setOpenDocCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleDocUpload = async (file, category) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    try {
      const res = await fetchAuth(`${API_BASE}/api/vault/upload`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        setToastMessage("Document uploaded successfully!");
        setTimeout(() => setToastMessage(""), 3000);
        fetchAuth(`${API_BASE}/api/documents`)
          .then(r => r.json())
          .then(data => { if (data.documents) setDocumentsList(data.documents); });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDoc = async (category, filename) => {
    try {
      const res = await fetch(`${API_BASE}/api/documents/${category}/${filename}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setToastMessage("Document deleted.");
        setTimeout(() => setToastMessage(""), 3000);
        fetchAuth(`${API_BASE}/api/documents`)
          .then(r => r.json())
          .then(data => { if (data.documents) setDocumentsList(data.documents); });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !selectedFile) return;

    const userMsg = { id: Date.now(), role: 'user', text: inputText || (selectedFile ? `[Attached File: ${selectedFile.name}]` : ""), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);

    const currentText = inputText;
    const currentFile = selectedFile;

    setInputText('');
    setSelectedFile(null);
    setIsTyping(true);

    try {
      let extractedText = "";
      if (currentFile) {
        const formData = new FormData();
        formData.append("file", currentFile);
        const uploadRes = await fetchAuth(`${API_BASE}/api/upload`, {
          method: "POST",
          body: formData
        });
        if (!uploadRes.ok) throw new Error("Failed to process file");
        const uploadData = await uploadRes.json();
        extractedText = `\n\n[FILE CONTENT OF ${currentFile.name}]\n${uploadData.text}`;
      }

      const finalMessage = currentText + extractedText;
      const endpoint = finalMessage.startsWith('/') ? '/api/commands' : '/api/chat';

      const response = await fetchAuth(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: finalMessage })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Server returned an error");
      }

      setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: data.response || "No response text.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);

      // Auto-refresh dashboard data after any command so UI updates without manual refresh
      if (finalMessage.startsWith('/')) {
        fetchAuth(`${API_BASE}/api/dashboard`)
          .then(r => r.json())
          .then(dbData => setDashboardData(dbData))
          .catch(err => console.error("Auto-refresh failed", err));
      }

      if (data.response && (data.response.includes("regenerating") || data.response.includes("updating your study plan") || data.response.includes("restructuring your curated study plan"))) {
        const pollInterval = setInterval(async () => {
          try {
            const res = await fetchAuth(`${API_BASE}/api/status/study_plan`);
            const statusData = await res.json();
            if (!statusData.is_generating) {
              clearInterval(pollInterval);
              setToastMessage("✅ Your study plan has been successfully updated!");
              setTimeout(() => setToastMessage(""), 5000);

              // Refresh both study plan and dashboard when background task finishes
              fetchAuth(`${API_BASE}/api/study_plan`)
                .then(r => r.json())
                .then(d => {
                  if (d.plan && Array.isArray(d.plan)) setStudyPlan(d.plan);
                });
              fetchAuth(`${API_BASE}/api/dashboard`)
                .then(r => r.json())
                .then(dbData => setDashboardData(dbData));
            }
          } catch (e) {
            console.error("Status polling failed", e);
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Failed to send message", error);
      setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: `Error: ${error.message}. Is your AI model running?`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Fetch onboarding status
    fetchAuth(`${API_BASE}/api/onboarding/status`)
      .then(res => res.json())
      .then(status => {
        setOnboardingStatus(status);
        if (!status.has_profile) {
          setShowOnboarding(true);
        } else {
          // Profile exists, we can fetch dashboard
          fetchAuth(`${API_BASE}/api/profile`)
            .then(res => res.json())
            .then(data => {
              setProfile(data.profile);
              fetchAuth(`${API_BASE}/api/dashboard`)
                .then(res => res.json())
                .then(dbData => setDashboardData(dbData))
                .catch(err => console.error("Failed to fetch dashboard data.", err));
            });
        }
      })
      .catch(err => {
        console.error("Failed to fetch onboarding status.", err);
      });
  }, [isAuthenticated]);

  // Global Evaluation Status Polling — stops automatically once done
  useEffect(() => {
    if (isAuthenticated && onboardingStatus?.has_taken_assessment) {
      let pollRef = null;
      const check = () => {
        fetchAuth(`${API_BASE}/api/assessment/eval_status`)
          .then(res => res.json())
          .then(data => {
            setGlobalEvalStatus(data.status);
            if (data.status === 'done' && pollRef) {
              clearInterval(pollRef);
              pollRef = null;
            }
          })
          .catch(err => console.error(err));
      };
      check(); // run immediately
      pollRef = setInterval(check, 5000);
      return () => { if (pollRef) clearInterval(pollRef); };
    }
  }, [isAuthenticated, onboardingStatus?.has_taken_assessment]);

  // Instant Lock Bouncer
  useEffect(() => {
    if (onboardingStatus?.is_locked) {
      const lockedTabs = ['AI Chat', 'Calendar', 'Skill Board', 'Study Plan', 'Progress', 'Mistakes'];
      if (lockedTabs.includes(activeTab)) {
        setActiveTab('Documents');
        setToastMessage("Access restricted. Please upload your CV and take the assessment to unlock.");
        setTimeout(() => setToastMessage(""), 4000);
      }
    }
  }, [onboardingStatus, activeTab]);

  const handleStartAssessment = () => {
    setShowOnboarding(false);
    setShowAssessment(true);
  };
  const handleLogout = () => {
    localStorage.removeItem('mentor_token');
    localStorage.removeItem('mentor_user');
    setIsAuthenticated(false);
    window.location.reload();
  };

  return (
    <>
      { !isAuthenticated ? (
        <Login onLogin={(name) => {
          setUserName(name);
          setIsAuthenticated(true);
        }} />
      ) : (
        <div className="flex h-screen bg-[#0d0c0b] text-[#e0d8cd] overflow-hidden font-sans">
          <AnimatePresence>
            {showOnboarding && (
              <Onboarding key="onboarding" initialData={onboardingStatus} onComplete={handleStartAssessment} />
            )}

            {showAssessment && (
              <motion.div
                key="assessment"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-[#0d0c0b]"
              >
                <Assessment 
                   isInitial={!onboardingStatus.has_taken_assessment} 
                   onClose={() => setShowAssessment(false)} 
                   onComplete={() => {
                     fetchAuth(`${API_BASE}/api/onboarding/status`)
                       .then(res => res.json())
                       .then(status => setOnboardingStatus(status));
                     fetchAuth(`${API_BASE}/api/dashboard`)
                       .then(r => r.json())
                       .then(dbData => setDashboardData(dbData));
                   }} 
                />
              </motion.div>
            )}
          </AnimatePresence>

        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-6 right-6 bg-[#161311] border border-[#cba36b] text-[#cba36b] px-6 py-3 rounded-xl font-medium shadow-[0_0_15px_rgba(203,163,107,0.2)] z-50 flex items-center space-x-2"
            >
              <Target size={18} />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className="w-64 bg-[#0d0c0b] border-r border-[#2a2522] flex flex-col justify-between hidden lg:flex shrink-0 relative z-10">
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-8 py-8">
              <div className="flex items-center space-x-3 mb-1">
                <span className="text-2xl text-[#cba36b]">✨</span>
                <span className="text-xl font-bold tracking-wider text-[#e0d8cd]">Mentor AI</span>
              </div>
              <p className="text-xs text-[#8a7b6b] tracking-widest pl-9 uppercase">Plan. Practice. Progress.</p>
            </div>
            {globalEvalStatus === 'pending' && (
              <div className="mx-4 my-2 px-3 py-2 bg-amber-950/40 border border-amber-500/30 rounded-lg flex items-start space-x-2">
                <RefreshCw size={14} className="text-amber-400 mt-0.5 animate-spin shrink-0" />
                <p className="text-[10px] text-amber-300">AI is evaluating your assessment. Skills will update soon.</p>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-1">
              <SidebarItem icon={MessageSquare} text="AI Chat" active={activeTab === 'AI Chat'} onClick={() => setActiveTab('AI Chat')} disabled={onboardingStatus.is_locked} onDisabledClick={() => setToastMessage("Please complete Documents and Assessment to unlock.")} />
              <SidebarItem icon={CalendarIcon} text="Calendar" active={activeTab === 'Calendar'} onClick={() => setActiveTab('Calendar')} disabled={onboardingStatus.is_locked} onDisabledClick={() => setToastMessage("Please complete Documents and Assessment to unlock.")} />
              <SidebarItem icon={BarChart2} text="Skill Board" active={activeTab === 'Skill Board'} onClick={() => setActiveTab('Skill Board')} disabled={onboardingStatus.is_locked} onDisabledClick={() => setToastMessage("Please complete Documents and Assessment to unlock.")} />
              <SidebarItem icon={CheckCircle} text="Assessment" active={showAssessment} onClick={handleStartAssessment} />
              <SidebarItem icon={Folder} text="Documents" active={activeTab === 'Documents'} onClick={() => setActiveTab('Documents')} />
              <SidebarItem icon={FileSearch} text="ATS Matcher" active={activeTab === 'ATS Matcher'} onClick={() => setActiveTab('ATS Matcher')} disabled={onboardingStatus.is_locked} onDisabledClick={() => setToastMessage("Please complete Documents and Assessment to unlock.")} />
              <SidebarItem icon={FileText} text="Notes" active={activeTab === 'Notes'} onClick={() => setActiveTab('Notes')} />
              <SidebarItem icon={Target} text="Study Plan" active={activeTab === 'Study Plan'} onClick={() => setActiveTab('Study Plan')} disabled={onboardingStatus.is_locked} onDisabledClick={() => setToastMessage("Please complete Documents and Assessment to unlock.")} />
              <SidebarItem icon={AlertTriangle} text="Mistakes" active={activeTab === 'Mistakes'} onClick={() => setActiveTab('Mistakes')} disabled={onboardingStatus.is_locked} onDisabledClick={() => setToastMessage("Please complete Documents and Assessment to unlock.")} />
              <SidebarItem icon={Briefcase} text="Career Review" active={activeTab === 'Career Review'} onClick={() => setActiveTab('Career Review')} />
              <SidebarItem icon={TrendingUp} text="Progress" active={activeTab === 'Progress'} onClick={() => setActiveTab('Progress')} disabled={onboardingStatus.is_locked} onDisabledClick={() => setToastMessage("Please complete Documents and Assessment to unlock.")} />
              <SidebarItem icon={Settings} text="Settings" active={activeTab === 'Settings'} onClick={() => setActiveTab('Settings')} />
            </nav>

            {/* Footer Items */}
            <div className="px-6 py-6 border-t border-[#2a2522]">
              <div onClick={() => setActiveTab('Generated Docs')} className="flex items-center justify-between p-3 glass-panel rounded-xl cursor-pointer hover:bg-[#1e1916] transition-colors mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-[#2a2522] flex items-center justify-center overflow-hidden shrink-0">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Adina" alt="User" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 truncate pr-2">
                    <p className="text-sm font-semibold text-[#e0d8cd] truncate">{userName || profile?.name || 'User'}</p>
                    <p className="text-xs text-[#8a7b6b] truncate">{profile?.course || 'Student'}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#8a7b6b]" />
              </div>

              <div className="text-center italic text-[#8a7b6b] text-sm px-4">
                "Discipline today, freedom tomorrow."
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col xl:flex-row bg-[#0d0c0b]">

          {/* Center Hub */}
          <div className="flex-1 p-4 lg:p-6 flex flex-col max-w-6xl mx-auto w-full border-r border-[#2a2522] h-full overflow-hidden">
            <header className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-medium mb-2 text-[#e0d8cd]">Good evening, {profile?.name ? profile.name.split(' ')[0] : 'User'}! ✨</h1>
                <p className="text-[#8a7b6b] text-sm">How can I help you plan and achieve your goals today?</p>
              </div>
              <div className="flex items-center space-x-4">
                <button className="w-10 h-10 rounded-full border border-[#2a2522] flex items-center justify-center text-[#8a7b6b] hover:text-[#cba36b] hover:border-[#cba36b] transition-all bg-[#161311]">
                  <Search size={18} />
                </button>
                <button className="w-10 h-10 rounded-full border border-[#2a2522] flex items-center justify-center text-[#8a7b6b] hover:text-[#cba36b] hover:border-[#cba36b] transition-all bg-[#161311] relative">
                  <Bell size={18} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-[#cba36b] rounded-full"></span>
                </button>
                <button className="px-4 py-2 rounded-full border border-[#2a2522] flex items-center space-x-2 text-[#8a7b6b] hover:text-[#cba36b] hover:border-[#cba36b] transition-all bg-[#161311] text-sm font-medium">
                  <Plus size={16} /> <span>New Chat</span>
                </button>
              </div>
            </header>

            {activeTab === 'AI Chat' ? (
              <>
                {/* Central AI Interface */}
                <div className="flex-1 glass-panel rounded-2xl flex flex-col p-6 relative overflow-hidden bg-[#161311] min-h-0">
                  {/* Ambient background glow */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#cba36b] rounded-full blur-[150px] opacity-[0.03] pointer-events-none"></div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 px-4 min-h-0">
                    {/* Central Welcome Header (Scrolls with chat) */}
                    <div className="flex flex-col items-center justify-center pt-8 pb-4 shrink-0">
                      <div className="w-12 h-12 rounded-full border border-[#cba36b]/30 flex items-center justify-center mb-4 text-2xl text-[#cba36b] shadow-[0_0_30px_rgba(203,163,107,0.1)]">
                        ✨
                      </div>
                      <h2 className="text-2xl font-medium text-[#e0d8cd] mb-2 font-serif">Mentor AI</h2>
                      <p className="text-[#8a7b6b] text-sm">Your personal study & career companion.</p>
                    </div>

                    {/* Dynamic Message Box */}
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex space-x-4 max-w-2xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse space-x-reverse' : ''}`}>
                        {msg.role === 'ai' && (
                          <div className="w-8 h-8 shrink-0 rounded-full border border-[#cba36b]/30 flex items-center justify-center text-xs text-[#cba36b] mt-1">✨</div>
                        )}
                        <div className={`border rounded-2xl p-5 text-sm shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#cba36b]/10 border-[#cba36b]/30 text-[#e0d8cd] rounded-tr-none' : 'bg-[#1e1916] border-[#2a2522] text-[#e0d8cd] rounded-tl-none'}`}>
                          {msg.role === 'ai' && <p className="font-medium text-[#cba36b] mb-2">Mentor AI</p>}
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          <p className="text-right text-[10px] text-[#8a7b6b] mt-3">{msg.time}</p>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex space-x-4 max-w-2xl">
                        <div className="w-8 h-8 shrink-0 rounded-full border border-[#cba36b]/30 flex items-center justify-center text-xs text-[#cba36b] mt-1">✨</div>
                        <div className="bg-[#1e1916] border border-[#2a2522] rounded-2xl rounded-tl-none p-5 text-sm text-[#e0d8cd] shadow-sm flex space-x-1 items-center h-12">
                          <div className="w-1.5 h-1.5 bg-[#8a7b6b] rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 bg-[#8a7b6b] rounded-full animate-bounce delay-75"></div>
                          <div className="w-1.5 h-1.5 bg-[#8a7b6b] rounded-full animate-bounce delay-150"></div>
                        </div>
                      </div>
                    )}
                  </div>



                  {/* Input Area */}
                  <div className="relative mt-auto shrink-0 flex flex-col">
                    {selectedFile && (
                      <div className="flex items-center self-start bg-[#cba36b]/20 text-[#cba36b] text-xs px-3 py-1.5 rounded-t-lg border border-[#cba36b]/30 border-b-0 mb-[-1px] z-10 ml-4">
                        <FileText size={12} className="mr-2" />
                        <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                        <button onClick={() => setSelectedFile(null)} className="ml-2 hover:text-[#e0d8cd]">
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <div className="relative w-full">
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Message Mentor AI... (try /timetable or attach a PDF)"
                        className={`w-full bg-[#0d0c0b] border border-[#2a2522] py-4 pl-12 pr-16 text-sm text-[#e0d8cd] focus:outline-none focus:border-[#cba36b]/50 shadow-inner ${selectedFile ? 'rounded-b-2xl rounded-tr-2xl rounded-tl-none' : 'rounded-2xl'}`}
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => { if (e.target.files[0]) setSelectedFile(e.target.files[0]); }}
                        accept=".pdf,.txt"
                        className="hidden"
                      />
                      <button onClick={() => fileInputRef.current?.click()} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a7b6b] hover:text-[#e0d8cd] transition-colors" title="Upload Document">
                        <Plus size={20} />
                      </button>
                      <button onClick={sendMessage} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#cba36b] rounded-xl flex items-center justify-center text-[#0d0c0b] hover:bg-[#d9ba88] transition-colors">
                        <Send size={16} className="ml-1" />
                      </button>
                    </div>
                  </div>
                  <p className="text-center text-[10px] text-[#8a7b6b] mt-4 shrink-0">AI can make mistakes. Please verify important information.</p>
                </div>

              </>
            ) : activeTab === 'Skill Board' ? (
              <div className="flex-1 glass-panel rounded-2xl flex flex-col p-8 bg-[#161311] overflow-y-auto custom-scrollbar">
                <div className="flex items-center space-x-4 mb-8">
                  <div className="w-12 h-12 rounded-full border border-[#2a2522] flex items-center justify-center text-[#cba36b] bg-[#1e1916]">
                    <BarChart2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-medium text-[#e0d8cd]">Skill Board</h2>
                    <p className="text-[#8a7b6b] text-sm">Track your proficiency across core competencies.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {dashboardData?.skills && dashboardData.skills.length > 0 ? (
                    dashboardData.skills.map((skill, idx) => (
                      <div key={idx} className="bg-[#0d0c0b] border border-[#2a2522] rounded-xl p-5 hover:border-[#cba36b]/30 transition-all group">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-medium text-[#e0d8cd]">{skill.topic}</h3>
                          <span className="text-xs font-semibold text-[#cba36b]">{skill.proficiency}%</span>
                        </div>
                        <div className="w-full h-2 bg-[#2a2522] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#8a6b6b] to-[#cba36b] rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${skill.proficiency}%` }}
                          ></div>
                        </div>
                        <p className="text-[10px] text-[#8a7b6b] mt-3 group-hover:text-[#e0d8cd]/50 transition-colors">
                          Last tested: {skill.last_tested || 'Never'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center text-[#8a7b6b] py-10">No skills found in database.</div>
                  )}
                </div>
              </div>
            ) : activeTab === 'ATS Matcher' ? (
              <ResumeATS />
            ) : activeTab === 'Study Plan' ? (
              <div className="flex-1 glass-panel rounded-2xl flex flex-col p-8 bg-[#161311] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full border border-[#2a2522] flex items-center justify-center text-[#cba36b] bg-[#1e1916]">
                      <Target size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-medium text-[#e0d8cd]">Study Plan Roadmap</h2>
                      <p className="text-[#8a7b6b] text-sm">AI-curated via Gemini · auto-updates on every deadline or timetable change.</p>
                    </div>
                  </div>
                  {/* Version History Dropdown */}
                  {planVersions.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-[#8a7b6b] text-xs">Version:</span>
                      <select
                        className="bg-[#1e1916] border border-[#2a2522] text-[#cba36b] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#cba36b] cursor-pointer"
                        value={selectedVersion || ''}
                        onChange={e => {
                          const fn = e.target.value;
                          if (!fn) {
                            // Latest
                            fetchAuth(`${API_BASE}/api/study_plan`)
                              .then(r => r.json())
                              .then(d => { if (d.plan) setStudyPlan(d.plan); });
                            setSelectedVersion(null);
                          } else {
                            fetch(`${API_BASE}/api/study_plan/versions/${fn}`)
                              .then(r => r.json())
                              .then(d => { if (d.plan) setStudyPlan(d.plan); });
                            setSelectedVersion(fn);
                          }
                        }}
                      >
                        <option value="">Latest</option>
                        {planVersions.map(v => (
                          <option key={v.filename} value={v.filename}>
                            {new Date(v.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {v.trigger.length > 28 ? v.trigger.slice(0, 28) + '…' : v.trigger}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[#cba36b] before:via-[#cba36b]/30 before:to-transparent">
                  {studyPlan && studyPlan.length > 0 ? (
                    studyPlan.map((day, idx) => {
                      const today = new Date();
                      const dateStr = day.date || day.day;
                      let isToday = false;
                      if (dateStr) {
                        const d = new Date(dateStr);
                        isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                      }

                      const opacityClass = isToday ? "opacity-100 scale-[1.02] z-20" : "opacity-40 hover:opacity-100 transition-all duration-300";
                      const glowClass = isToday ? "shadow-[0_0_30px_rgba(203,163,107,0.3)] border-[#cba36b] bg-[#1e1916]" : "border-[#cba36b]/30 bg-[#0d0c0b] hover:border-[#cba36b]";
                      const dotClass = isToday ? "shadow-[0_0_20px_rgba(203,163,107,0.6)] font-bold bg-[#cba36b] text-[#161311]" : "shadow-[0_0_15px_rgba(203,163,107,0.2)] bg-[#161311] text-[#cba36b]";

                      return (
                        <div key={idx} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active ${opacityClass}`}>
                          {/* Timeline Icon */}
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-[#cba36b] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors ${dotClass}`}>
                            {idx + 1}
                          </div>

                          {/* Card */}
                          <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border transition-all duration-300 shadow-lg ${glowClass}`}>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className={`font-bold ${isToday ? 'text-[#e0d8cd]' : 'text-[#cba36b]'}`}>
                                {dateStr} {isToday && <span className="ml-2 text-xs bg-[#cba36b] text-[#161311] px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                              </h3>
                              <div className="flex space-x-2">
                                {day.task_type && (
                                  <span className={`text-xs px-2 py-1 rounded border ${day.task_type.includes('Speed') || day.task_type.includes('Review') ? 'bg-amber-900/20 text-amber-500 border-amber-900/50' : 'bg-[#1e1916] text-[#8a7b6b] border-[#2a2522]'}`}>
                                    {day.task_type}
                                  </span>
                                )}
                                <span className="text-xs text-[#8a7b6b] bg-[#1e1916] border border-[#2a2522] px-2 py-1 rounded">{day.time}</span>
                              </div>
                            </div>
                            <p className="text-[#e0d8cd] font-medium mb-3 border-b border-[#2a2522] pb-2">Focus: {day.focus}</p>
                            <ul className="space-y-2">
                              {day.tasks && day.tasks.map((task, tIdx) => (
                                <li key={tIdx} className="flex items-start space-x-2 text-sm text-[#8a7b6b]">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#cba36b] mt-1.5 shrink-0"></div>
                                  <span>{task}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )
                    })

                  ) : (
                    <div className="text-center text-[#8a7b6b] py-10 relative z-10 bg-[#161311] rounded-xl border border-[#2a2522] w-full max-w-md mx-auto">
                      <Target size={48} className="opacity-20 mb-4 mx-auto" />
                      <p>Your Study Plan is empty.</p>
                      <p className="text-xs mt-2">Add a company with <code className="text-[#cba36b]">/company</code> or set your schedule with <code className="text-[#cba36b]">/timetable</code> — the plan generates automatically.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'Mistakes' ? (
              <MistakesView />
            ) : activeTab === 'Career Review' ? (
              <div className="flex-1 glass-panel rounded-2xl flex flex-col p-8 bg-[#161311] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full border border-[#2a2522] flex items-center justify-center text-[#cba36b] bg-[#1e1916]">
                      <Briefcase size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-medium text-[#e0d8cd]">Career Improvement Review</h2>
                      <p className="text-[#8a7b6b] text-sm">AI-driven analysis based on your academic documents.</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center space-x-3">
                      {!isEditingScores && (
                        <button
                          onClick={() => setIsEditingScores(true)}
                          className="px-4 py-2 rounded-lg font-medium bg-[#1e1916] text-[#e0d8cd] border border-[#2a2522] hover:bg-[#2a2522] transition-colors flex items-center"
                        >
                          <Edit2 size={16} className="mr-2" /> Edit Scores
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (!onboardingStatus.has_cv || !academicProfile.tenth || !academicProfile.twelfth || !academicProfile.cgpa) {
                            alert("Please ensure your CV is uploaded in Documents and your 10th, 12th, and CGPA scores are saved before generating a review.");
                            if (!academicProfile.tenth) setIsEditingScores(true);
                            return;
                          }
                          setReviewLoading(true);
                          fetchAuth(`${API_BASE}/api/improvement_review/generate`, { method: "POST" })
                            .then(r => r.json())
                            .then(d => { setCareerReview(d.review); setReviewLoading(false); })
                            .catch(e => { console.error(e); setReviewLoading(false); });
                        }}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${onboardingStatus.is_locked ? 'bg-[#2a2522] text-[#8a7b6b] cursor-not-allowed' : 'bg-[#cba36b] text-[#161311] hover:bg-[#d9ba88]'}`}
                        disabled={reviewLoading || onboardingStatus.is_locked}
                      >
                        {reviewLoading ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Play size={16} className="mr-2" />}
                        {reviewLoading ? "Analyzing Profile..." : (careerReview ? "Regenerate Review" : "Generate Review")}
                      </button>
                    </div>
                    {onboardingStatus.is_locked && (
                      <span className="text-[10px] text-red-400 mt-1">Upload required documents and take assessment first.</span>
                    )}
                  </div>
                </div>

                <div className={`grid grid-cols-1 ${isEditingScores ? 'md:grid-cols-3 gap-6' : 'md:grid-cols-1'} mb-8`}>
                  {isEditingScores && (
                    <div className="md:col-span-1 bg-[#1e1916] p-5 rounded-xl border border-[#2a2522]">
                    <h3 className="text-[#e0d8cd] font-medium mb-4 flex items-center"><BookOpen size={16} className="mr-2 text-[#cba36b]" /> Academic Scores</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-[#8a7b6b] mb-1">10th Grade (%)</label>
                        <input type="text" disabled={!isEditingScores} value={academicProfile.tenth} onChange={e => setAcademicProfile({ ...academicProfile, tenth: e.target.value })} className={`w-full bg-[#0d0c0b] border border-[#2a2522] ${!isEditingScores ? 'text-[#8a7b6b] opacity-80' : 'text-[#e0d8cd]'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#cba36b] transition-colors`} placeholder="e.g. 95%" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8a7b6b] mb-1">12th Grade (%)</label>
                        <input type="text" disabled={!isEditingScores} value={academicProfile.twelfth} onChange={e => setAcademicProfile({ ...academicProfile, twelfth: e.target.value })} className={`w-full bg-[#0d0c0b] border border-[#2a2522] ${!isEditingScores ? 'text-[#8a7b6b] opacity-80' : 'text-[#e0d8cd]'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#cba36b] transition-colors`} placeholder="e.g. 92%" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8a7b6b] mb-1">Overall CGPA</label>
                        <input type="text" disabled={!isEditingScores} value={academicProfile.cgpa} onChange={e => setAcademicProfile({ ...academicProfile, cgpa: e.target.value })} className={`w-full bg-[#0d0c0b] border border-[#2a2522] ${!isEditingScores ? 'text-[#8a7b6b] opacity-80' : 'text-[#e0d8cd]'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#cba36b] transition-colors`} placeholder="e.g. 8.5" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8a7b6b] mb-1">Semester SGPAs (Optional)</label>
                        <input type="text" disabled={!isEditingScores} value={academicProfile.sgpas} onChange={e => setAcademicProfile({ ...academicProfile, sgpas: e.target.value })} className={`w-full bg-[#0d0c0b] border border-[#2a2522] ${!isEditingScores ? 'text-[#8a7b6b] opacity-80' : 'text-[#e0d8cd]'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#cba36b] transition-colors`} placeholder="e.g. S1: 8.2, S2: 8.7" />
                      </div>

                      {isEditingScores && (
                        <button
                          onClick={() => {
                            fetchAuth(`${API_BASE}/api/academic_profile`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(academicProfile)
                            }).then(() => {
                              setToastMessage("Scores saved!");
                              setTimeout(() => setToastMessage(""), 3000);
                              setIsEditingScores(false); // Lock fields
                            });
                          }}
                          className="w-full mt-2 bg-[#cba36b] hover:bg-[#d9ba88] text-[#161311] font-medium text-sm py-2 rounded-lg transition-colors flex items-center justify-center"
                        >
                          <Save size={14} className="mr-2" /> Save Scores
                        </button>
                      )}
                    </div>
                  </div>
                  )}

                  <div className={`${isEditingScores ? 'md:col-span-2' : 'md:col-span-1'} bg-[#0d0c0b] border border-[#2a2522] rounded-xl p-6 min-h-[400px]`}>
                    {careerReview ? (
                      <div className="prose prose-invert max-w-none text-sm text-[#e0d8cd] leading-relaxed">
                        <ReactMarkdown>{careerReview}</ReactMarkdown>
                      </div>
                    ) : reviewLoading ? (
                      <div className="flex flex-col items-center justify-center h-full text-[#8a7b6b] py-20">
                        <RefreshCw size={32} className="animate-spin text-[#cba36b] mb-4" />
                        <p>Gemini is reviewing your documents (10th, 12th, Semesters, CV)...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-[#8a7b6b] py-20">
                        <Briefcase size={48} className="opacity-20 mb-4" />
                        <p>No review generated yet.</p>
                        <p className="text-xs mt-2 text-center max-w-sm">Make sure to save your Academic Scores on the left and upload your CV in the Documents tab, then click Generate.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'Calendar' ? (
              <CalendarView
                dashboardData={dashboardData}
                onEventAdded={() => {
                  fetchAuth(`${API_BASE}/api/dashboard`)
                    .then(res => res.json())
                    .then(data => setDashboardData(data))
                    .catch(err => console.error("Error refreshing dashboard data", err));
                }}
              />
            ) : activeTab === 'Documents' ? (
              <DocumentsView onUpdate={() => {
                fetchAuth(`${API_BASE}/api/onboarding/status`)
                  .then(res => res.json())
                  .then(status => setOnboardingStatus(status));
              }} />
            ) : activeTab === 'Notes' ? (
              <NotesView />
            ) : activeTab === 'Generated Docs' ? (
              <div className="flex-1 glass-panel rounded-2xl flex flex-col p-8 bg-[#161311] overflow-y-auto custom-scrollbar">
                <div className="flex items-center space-x-4 mb-8">
                  <div className="w-12 h-12 rounded-full border border-[#2a2522] flex items-center justify-center text-[#cba36b] bg-[#1e1916]">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-medium text-[#e0d8cd]">Generated Documents</h2>
                    <p className="text-[#8a7b6b] text-sm">All files generated by your AI mentor.</p>
                  </div>
                </div>
                
                {documentsList && documentsList["Generated"] && documentsList["Generated"].length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {documentsList["Generated"].map(filename => (
                      <div key={filename} className="p-4 bg-[#0d0c0b] border border-[#2a2522] rounded-xl flex items-center justify-between hover:border-[#cba36b]/30 transition-colors">
                        <div className="flex items-center space-x-3">
                          <FileText size={20} className="text-[#cba36b]" />
                          <p className="text-sm font-medium text-[#e0d8cd] truncate max-w-[200px]">{filename}</p>
                        </div>
                        <a 
                          href={`${API_BASE}/api/documents/Generated/${filename}`} 
                          download
                          className="p-2 text-[#8a7b6b] hover:text-[#e0d8cd] hover:bg-[#2a2522] rounded-lg transition-colors"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[#8a7b6b] py-20">
                    <Folder size={48} className="opacity-20 mb-4" />
                    <p>No generated documents yet.</p>
                  </div>
                )}
              </div>
            ) : activeTab === 'Settings' ? (
              <SettingsView 
                onLogout={handleLogout} 
                theme={theme} 
                setTheme={setTheme}
                onUpdate={() => {
                  fetchAuth(`${API_BASE}/api/onboarding/status`)
                    .then(res => res.json())
                    .then(status => setOnboardingStatus(status));
                }} 
              />
            ) : (
              <div className="flex-1 glass-panel rounded-2xl flex flex-col items-center justify-center p-8 bg-[#161311]">
                <div className="w-16 h-16 rounded-full border border-[#2a2522] flex items-center justify-center mb-6 text-[#8a7b6b]">
                  {activeTab === 'Skill Board' && <BarChart2 size={32} />}
                  {activeTab === 'Study Plan' && <Target size={32} />}
                  {activeTab === 'Documents' && <Folder size={32} />}
                  {activeTab === 'Progress' && <TrendingUp size={32} />}
                  {activeTab === 'Career Review' && <Briefcase size={32} />}
                  {activeTab === 'Mistakes' && <AlertTriangle size={32} />}
                </div>
                <h2 className="text-2xl font-medium text-[#e0d8cd] mb-2">{activeTab}</h2>
                <p className="text-[#8a7b6b] text-sm text-center max-w-md">This view is currently under construction. Please return to the AI Chat to interact with Mentor AI.</p>
              </div>
            )}
          </div>

          {/* Right Sidebar (Widgets) */}
          <aside className="hidden xl:block w-80 bg-[#0d0c0b] p-8 space-y-6 overflow-y-auto custom-scrollbar h-full shrink-0">

            {/* AI Insight Widget */}
            {dashboardData?.insight && (
              <div className="glass-panel p-5 bg-gradient-to-br from-[#1e1916] to-[#161311] border border-[#cba36b]/40 shadow-[0_0_15px_rgba(203,163,107,0.15)] rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#cba36b]/20 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                <div className="flex items-center space-x-2 mb-3">
                  <div className="bg-[#cba36b]/20 p-1.5 rounded text-[#cba36b]">
                    <Target size={14} />
                  </div>
                  <h3 className="font-semibold text-sm text-[#e0d8cd]">Today's Focus</h3>
                </div>
                <p className="text-xs text-[#e0d8cd] leading-relaxed relative z-10">
                  {dashboardData.insight}
                </p>
                
                {dashboardData?.urgent_round && (
                  <div className="mt-4 pt-3 border-t border-[#cba36b]/20 relative z-10">
                    <p className="text-[10px] text-[#cba36b] font-medium mb-2 uppercase tracking-wide flex items-center">
                      <Bell size={10} className="mr-1" /> Upcoming: {dashboardData.urgent_round.company} Round
                    </p>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetchAuth(`${API_BASE}/api/round_prep`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              company: dashboardData.urgent_round.company,
                              round_name: dashboardData.urgent_round.title,
                              days_left: dashboardData.urgent_round.days_left
                            })
                          });
                          const data = await res.json();
                          // Displaying in a simple alert for now, could be a modal later
                          alert("AI PREP TIPS:\n\n" + data.tips);
                        } catch(e) {
                          alert("Failed to generate prep tips.");
                        }
                      }}
                      className="w-full bg-[#cba36b]/10 hover:bg-[#cba36b]/20 text-[#cba36b] text-xs font-medium py-1.5 rounded transition-colors"
                    >
                      Generate Prep Guide
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Today's Study Plan */}
            <div className="glass-panel p-6 bg-[#161311]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-medium text-[#e0d8cd]">Today's Plan</h3>
                <button
                  className="text-xs text-[#cba36b] hover:underline"
                  onClick={() => setActiveTab('Study Plan')}
                >
                  View All
                </button>
              </div>

              {(() => {
                const today = new Date();
                const todaysPlan = studyPlan?.find(day => {
                  const dateStr = day.date || day.day;
                  if (!dateStr) return false;
                  const d = new Date(dateStr);
                  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                });

                if (!todaysPlan) {
                  return (
                    <div className="text-center py-6 text-[#8a7b6b] text-sm italic border border-[#2a2522] rounded-xl bg-[#0d0c0b]">
                      No study plan set for today.
                    </div>
                  );
                }

                return (
                  <div className="bg-[#0d0c0b] border border-[#cba36b]/30 rounded-xl p-4 shadow-[0_0_15px_rgba(203,163,107,0.1)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-[#cba36b]/10 blur-xl rounded-full translate-x-1/2 -translate-y-1/2"></div>

                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs text-[#cba36b] font-bold mb-1">{todaysPlan.date || todaysPlan.day}</p>
                        <h4 className="text-sm font-medium text-[#e0d8cd]">Focus: {todaysPlan.focus}</h4>
                      </div>
                      {todaysPlan.task_type && (
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${todaysPlan.task_type.includes('Speed') || todaysPlan.task_type.includes('Review') ? 'bg-amber-900/20 text-amber-500 border-amber-900/50' : 'bg-[#1e1916] text-[#8a7b6b] border-[#2a2522]'}`}>
                          {todaysPlan.task_type}
                        </span>
                      )}
                    </div>

                    <ul className="space-y-2 mt-4 pt-4 border-t border-[#2a2522]">
                      {todaysPlan.tasks?.map((task, tIdx) => (
                        <li key={tIdx} className="flex items-start space-x-2 text-xs text-[#8a7b6b]">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#cba36b] mt-1 shrink-0"></div>
                          <span className="leading-tight">{task}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex items-center text-xs text-[#8a7b6b]">
                      <Target size={12} className="mr-1 text-[#cba36b]" /> {todaysPlan.time || '1-2 hours'}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Upcoming Events */}
            <div className="glass-panel p-6 bg-[#161311]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-medium text-[#e0d8cd]">Upcoming Events</h3>
                <button
                  className="text-xs text-[#8a7b6b] hover:text-[#cba36b] flex items-center"
                  onClick={() => setActiveTab('Calendar')}
                >
                  <Plus size={12} className="mr-1" /> Add
                </button>
              </div>
              <div className="space-y-6 overflow-y-auto max-h-[250px] custom-scrollbar pr-2">
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const threeWeeksFromNow = new Date(today);
                  threeWeeksFromNow.setDate(today.getDate() + 21);

                  const filteredDeadlines = (dashboardData?.deadlines || []).filter(d => {
                    const dDate = new Date(d.due_at);
                    dDate.setHours(0, 0, 0, 0);
                    return dDate >= today && dDate <= threeWeeksFromNow;
                  });

                  if (filteredDeadlines.length === 0) {
                    return <div className="text-xs text-[#8a7b6b] italic text-center py-4 border border-[#2a2522] rounded-xl bg-[#0d0c0b]">No upcoming events in the next 3 weeks.</div>;
                  }

                  return Object.entries(filteredDeadlines.reduce((acc, curr) => {
                    if (!acc[curr.company]) acc[curr.company] = { role: curr.role, rounds: [] };
                    acc[curr.company].rounds.push(curr);
                    return acc;
                  }, {})).map(([company, data], idx) => (
                    <div key={idx} className="flex flex-col space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-semibold text-[#e0d8cd]">{company} <span className="text-xs font-normal text-[#8a7b6b]">({data.role})</span></p>
                      </div>
                      <div className="pl-4 border-l border-[#2a2522] space-y-4">
                        {data.rounds.map((round, rIdx) => {
                          let colorClass = "bg-[#cba36b] text-[#cba36b] border-[#cba36b]/20";
                          if (round.title?.toLowerCase().includes("interview")) colorClass = "bg-[#8a6b6b] text-[#8a6b6b] border-[#8a6b6b]/20";
                          if (round.title?.toLowerCase().includes("test") || round.title?.toLowerCase().includes("assessment")) colorClass = "bg-[#6a9a7a] text-[#6a9a7a] border-[#6a9a7a]/20";

                          return (
                            <div key={rIdx} className="flex justify-between items-start group cursor-pointer">
                              <div className="flex space-x-3">
                                <div className={`w-1.5 h-1.5 rounded-full ${colorClass.split(' ')[0]} mt-2 shrink-0`}></div>
                                <div>
                                  <p className="text-sm text-[#e0d8cd] group-hover:text-[#cba36b] transition-colors">{round.title}</p>
                                  <p className="text-xs text-[#8a7b6b] mt-1">{new Date(round.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                              </div>
                              <span className={`text-[10px] px-2 py-1 bg-opacity-10 rounded border ${colorClass.split(' ')[1]} ${colorClass.split(' ')[2]} bg-black/20`}>
                                {round.title?.split(' ')[0]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass-panel p-6 bg-[#161311]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-medium text-[#e0d8cd]">Quick Stats</h3>
                <button className="text-xs text-[#cba36b] hover:underline">View Progress</button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0d0c0b] border border-[#2a2522] rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <BookOpen size={16} className="text-[#8a7b6b] mb-2" />
                  <p className="text-sm font-medium text-[#e0d8cd]">{dashboardData?.available_hours || 0} <span className="text-[10px] text-[#8a7b6b]">hrs</span></p>
                  <p className="text-[10px] text-[#8a7b6b] mt-1">Study Hours</p>
                </div>
                <div className="bg-[#0d0c0b] border border-[#2a2522] rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <svg className="text-[#8a7b6b] mb-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.954.954 0 0 0-.253.858c.224.972.3 1.984.223 3.012l-.008.106c-.11 1.32-.98 2.45-2.235 2.89l-1.815.639c-.287.102-.52.335-.622.622l-.639 1.815c-.44.125-1.57 2.125-2.89 2.235-.972.077-1.984 0-3.012-.223a.954.954 0 0 0-.858.253l-1.611 1.611c-.47.47-1.087.706-1.704.706s-1.233-.235-1.704-.706l-1.568-1.568a.953.953 0 0 0-.878-.289c-.981.149-1.989.149-2.97 0a.953.953 0 0 0-.878.289l-1.568 1.568c-.47.47-1.087.706-1.704.706s-1.233-.235-1.704-.706l-1.611-1.611a.954.954 0 0 0-.253-.858c.224-.972.3-1.984.223-3.012l-.008-.106c-.11-1.32-.98-2.45-2.235-2.89l-1.815-.639c-.287-.102-.52-.335-.622-.622l-.639-1.815c-.44-.125-1.57-2.125-2.89-2.235-.972-.077-1.984 0-3.012.223a.954.954 0 0 0 .858-.253l1.611-1.611c.47-.47 1.087-.706 1.704-.706s1.233.235 1.704.706l1.568 1.568c.23.23.556.338.878.289.981-.149 1.989-.149 2.97 0 .322.049.648-.059.878-.289l1.568-1.568c.47-.47 1.087-.706 1.704-.706s1.233.235 1.704.706l1.611 1.611c.148.148.337.234.542.253.972.224 1.984.3 3.012.223l.106-.008c1.32-.11 2.45-.98 2.89-2.235l.639-1.815c.102-.287.335-.52.622-.622l1.815-.639c.125-.44 2.125-1.57 2.235-2.89.077-.972 0-1.984-.223-3.012a.954.954 0 0 0 .253-.858l1.611-1.611c.47-.47.706-1.087.706-1.704s-.235-1.233-.706-1.704l-1.568-1.568c-.23-.23-.556-.338-.878-.289-.981.149-1.989.149-2.97 0z" /></svg>
                  <p className="text-sm font-medium text-[#e0d8cd]">{dashboardData?.stats?.questions || 0}</p>
                  <p className="text-[10px] text-[#8a7b6b] mt-1">Questions</p>
                </div>
                <div className="bg-[#0d0c0b] border border-[#2a2522] rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <Target size={16} className="text-[#8a7b6b] mb-2" />
                  <p className="text-sm font-medium text-[#e0d8cd]">{dashboardData?.stats?.tests || 0}</p>
                  <p className="text-[10px] text-[#8a7b6b] mt-1">Aptitude Tests</p>
                </div>
              </div>
            </div>
          </aside>
        </main>
      </div>
      )}
    </>
  );
}
