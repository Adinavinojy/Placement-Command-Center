import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Code, FileText, ArrowRight, PauseCircle, PlayCircle, CheckCircle, X, Clock, Zap, Brain, BookOpen, ChevronRight, ChevronDown, AlertTriangle, RefreshCw, Trophy, Target, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAuth } from '../api';

// ── Timer config ─────────────────────────────────────────────────────────────
const INITIAL_APT_SECS  = 30 * 60;   // 30 min
const INITIAL_CODE_SECS = 90 * 60;   // 1.5 hr
const REGULAR_APT_SECS  = 20 * 60;   // 20 min
const REGULAR_CODE_SECS = 60 * 60;   // 1 hr

// ── Timer Display ─────────────────────────────────────────────────────────────
function TimerDisplay({ seconds }) {
  const h = Math.floor(seconds / 3600);
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  const urgent = seconds < 300;
  const display = h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  return (
    <div className={`flex items-center space-x-2 font-mono text-lg font-bold ${urgent ? 'text-red-400 animate-pulse' : 'text-[#cba36b]'}`}>
      <Clock size={18} className={urgent ? 'animate-pulse' : ''} />
      <span>{display}</span>
    </div>
  );
}

// ── Instructions: Initial (one-time baseline) ─────────────────────────────────
function InitialInstructionsPage({ onProceed, onBack }) {
  return (
    <div className="flex h-screen bg-[#0d0c0b] text-[#e0d8cd] font-sans overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="w-full max-w-3xl mx-auto px-8 py-8"
      >
        <button onClick={onBack} className="flex items-center space-x-2 text-sm text-[#8a7b6b] hover:text-[#e0d8cd] transition-colors mb-6">
          <X size={16} /><span>Back to Dashboard</span>
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-amber-400 bg-amber-400/10 mb-4">
            <Trophy size={28} className="text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-[#e0d8cd] mb-2">Baseline Assessment</h1>
          <p className="text-[#8a7b6b] text-sm max-w-lg mx-auto">This is a <span className="text-amber-400 font-semibold">one-time assessment</span> that establishes your starting skill baseline. It will never be repeated.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Brain size={18} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-[#e0d8cd] text-sm">Aptitude Section</h3>
                <p className="text-xs text-[#8a7b6b] flex items-center mt-0.5"><Clock size={11} className="mr-1" />30 Minutes</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {['10 questions total (fixed set)', '4 Verbal Reasoning (Medium–Hard)', '3 Quantitative Aptitude (Medium–Hard)', '3 Logical Reasoning (Medium–Hard)', 'Timer auto-advances to coding when done'].map((item, i) => (
                <li key={i} className="flex items-start text-xs text-[#8a7b6b]">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1 mr-2 shrink-0" />{item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#cba36b]/10 border border-[#cba36b]/20 flex items-center justify-center">
                <Code size={18} className="text-[#cba36b]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#e0d8cd] text-sm">Coding Section</h3>
                <p className="text-xs text-[#8a7b6b] flex items-center mt-0.5"><Clock size={11} className="mr-1" />1.5 Hours</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {['3 LeetCode problems (fixed set)', '1 Easy problem — warm up', '1 Medium problem', '1 Hard problem', 'Solve on LeetCode, self-report result + time'].map((item, i) => (
                <li key={i} className="flex items-start text-xs text-[#8a7b6b]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#cba36b] mt-1 mr-2 shrink-0" />{item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-amber-950/30 border border-amber-400/20 rounded-xl p-4 mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle size={15} className="text-amber-400" />
            <h4 className="text-sm font-semibold text-amber-400">Important Rules</h4>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {[
              'Do not refresh or close the window',
              'Timer auto-advances — you cannot go back',
              'Aptitude: unanswered = marked wrong',
              'Coding: unreported = marked as Skipped',
              'Time taken directly affects your proficiency score',
              'Results update your Skill Board automatically',
            ].map((rule, i) => (
              <p key={i} className="text-xs text-[#8a7b6b] flex items-start">
                <span className="text-red-400 mr-2 mt-0.5">•</span>{rule}
              </p>
            ))}
          </div>
        </div>

        <button onClick={onProceed}
          className="w-full py-4 bg-amber-500 text-[#0d0c0b] rounded-xl font-bold text-base flex items-center justify-center space-x-2 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20">
          <span>Begin Baseline Assessment</span><ArrowRight size={20} />
        </button>
      </motion.div>
    </div>
  );
}

// ── Instructions: Regular (subsequent assessments) ────────────────────────────
function RegularInstructionsPage({ onProceed, onBack }) {
  return (
    <div className="flex h-screen bg-[#0d0c0b] text-[#e0d8cd] font-sans overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="w-full max-w-3xl mx-auto px-8 py-8"
      >
        <button onClick={onBack} className="flex items-center space-x-2 text-sm text-[#8a7b6b] hover:text-[#e0d8cd] transition-colors mb-6">
          <X size={16} /><span>Back to Dashboard</span>
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-[#cba36b] bg-[#cba36b]/10 mb-4">
            <Zap size={28} className="text-[#cba36b]" />
          </div>
          <h1 className="text-3xl font-bold text-[#e0d8cd] mb-2">Daily Assessment</h1>
          <p className="text-[#8a7b6b] text-sm max-w-lg mx-auto">Questions are pulled from <span className="text-[#cba36b] font-semibold">today's study plan</span> focus area or your weakest skills if no plan exists.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Brain size={18} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-[#e0d8cd] text-sm">Aptitude Section</h3>
                <p className="text-xs text-[#8a7b6b] flex items-center mt-0.5"><Clock size={11} className="mr-1" />20 Minutes</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {['6 questions — Medium & Hard only', '2 Verbal Reasoning', '2 Quantitative Aptitude', '2 Logical Reasoning', 'Never repeats seen questions'].map((item, i) => (
                <li key={i} className="flex items-start text-xs text-[#8a7b6b]">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1 mr-2 shrink-0" />{item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#cba36b]/10 border border-[#cba36b]/20 flex items-center justify-center">
                <Code size={18} className="text-[#cba36b]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#e0d8cd] text-sm">Coding Section</h3>
                <p className="text-xs text-[#8a7b6b] flex items-center mt-0.5"><Clock size={11} className="mr-1" />1 Hour</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {['2 LeetCode problems', '1 Medium problem', '1 Hard problem', 'Based on today\'s topic or your weakest skills', 'Solve on LeetCode, self-report result + time'].map((item, i) => (
                <li key={i} className="flex items-start text-xs text-[#8a7b6b]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#cba36b] mt-1 mr-2 shrink-0" />{item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-[#1e1916] border border-[#cba36b]/20 rounded-xl p-4 mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle size={15} className="text-amber-400" />
            <h4 className="text-sm font-semibold text-amber-400">Important Rules</h4>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {[
              'Do not refresh or close the window',
              'Aptitude timer auto-advances when done',
              'Unanswered aptitude = marked wrong',
              'Coding unreported = marked as Skipped',
              'Time taken penalises proficiency score',
              'Skills are updated automatically after',
            ].map((rule, i) => (
              <p key={i} className="text-xs text-[#8a7b6b] flex items-start">
                <span className="text-red-400 mr-2 mt-0.5">•</span>{rule}
              </p>
            ))}
          </div>
        </div>

        <button onClick={onProceed}
          className="w-full py-4 bg-[#cba36b] text-[#0d0c0b] rounded-xl font-bold text-base flex items-center justify-center space-x-2 hover:bg-[#d9ba88] transition-colors shadow-lg shadow-[#cba36b]/20">
          <span>Start Assessment</span><ArrowRight size={20} />
        </button>
      </motion.div>
    </div>
  );
}

// ── Loading Page ──────────────────────────────────────────────────────────────
function LoadingPage({ topic }) {
  return (
    <div className="flex h-screen bg-[#0d0c0b] items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-[#cba36b]/20"></div>
          <div className="absolute inset-0 rounded-full border-t-2 border-[#cba36b] animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-t-2 border-[#cba36b]/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
        </div>
        <h2 className="text-xl font-semibold text-[#e0d8cd] mb-2">Generating Your Assessment</h2>
        <p className="text-sm text-[#8a7b6b]">Pulling questions from today's study plan...</p>
        {topic && <p className="text-[#cba36b] font-medium mt-1">{topic}</p>}
        <p className="text-xs text-[#8a7b6b] mt-4">This takes a few seconds...</p>
      </motion.div>
    </div>
  );
}

// ── Aptitude Section ──────────────────────────────────────────────────────────
function AptitudeSection({ questions, answers, onAnswer, onNext, timer, paused, onTogglePause }) {
  const [current, setCurrent] = useState(0);
  const q = questions[current];
  const answered = questions.filter(q => answers[q.id] !== undefined).length;

  const sections = [...new Set(questions.map(q => q.section))];
  const sectionColor = {
    Verbal: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
    Quantitative: 'text-green-400 border-green-400/30 bg-green-400/10',
    Logical: 'text-purple-400 border-purple-400/30 bg-purple-400/10'
  };
  const diffColor = {
    Medium: 'text-amber-400 border-amber-900/50 bg-amber-900/20',
    Hard: 'text-red-400 border-red-900/50 bg-red-900/20'
  };

  return (
    <div className="flex h-screen bg-[#0d0c0b] text-[#e0d8cd] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-[#0d0c0b] border-r border-[#2a2522] flex flex-col p-5 shrink-0 overflow-y-auto custom-scrollbar">
        <div className="mb-5">
          <div className="flex items-center space-x-2 mb-1">
            <Brain size={15} className="text-[#cba36b]" />
            <span className="font-semibold text-[#e0d8cd] text-sm">Aptitude</span>
          </div>
          <p className="text-xs text-[#8a7b6b]">{answered}/{questions.length} answered</p>
          <div className="w-full h-1 bg-[#2a2522] rounded-full mt-2">
            <div className="h-full bg-[#cba36b] rounded-full transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
          </div>
        </div>

        <div className="space-y-1 flex-1">
          {sections.map(sec => (
            <div key={sec}>
              <p className="text-[10px] uppercase tracking-widest text-[#8a7b6b] mb-1 mt-3">{sec}</p>
              {questions.filter(qq => qq.section === sec).map(qq => {
                const idx = questions.indexOf(qq);
                const isAnswered = answers[qq.id] !== undefined;
                const isCurrent = idx === current;
                return (
                  <button key={qq.id} onClick={() => setCurrent(idx)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-all mb-1 ${isCurrent ? 'bg-[#cba36b]/20 text-[#cba36b] border border-[#cba36b]/30' : isAnswered ? 'bg-green-900/20 text-green-400 border border-green-900/30' : 'text-[#8a7b6b] hover:bg-[#1e1916] border border-transparent'}`}>
                    <span>{qq.id}</span>
                    {isAnswered && <CheckCircle size={10} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#cba36b]">Aptitude Assessment</h1>
            <p className="text-xs text-[#8a7b6b] mt-0.5">Question {current + 1} of {questions.length}</p>
          </div>
          <div className="flex items-center space-x-4">
            <TimerDisplay seconds={timer} />
            <button onClick={onTogglePause}
              className="flex items-center space-x-2 px-3 py-2 bg-[#161311] border border-[#2a2522] rounded-lg text-sm text-[#8a7b6b] hover:text-[#e0d8cd] transition-colors">
              {paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
              <span>{paused ? 'Resume' : 'Pause'}</span>
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col">
            <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-7 flex-1 flex flex-col">
              <div className="flex items-center space-x-3 mb-5">
                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${sectionColor[q.section] || 'text-[#cba36b] border-[#cba36b]/30 bg-[#cba36b]/10'}`}>{q.section}</span>
                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${diffColor[q.difficulty] || 'text-amber-400 border-amber-900/50 bg-amber-900/20'}`}>{q.difficulty || 'Medium'}</span>
              </div>

              <p className="text-[#e0d8cd] text-base leading-relaxed mb-8 flex-1">{q.question}</p>

              <div className="grid grid-cols-1 gap-3">
                {q.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const isSelected = answers[q.id] === letter;
                  return (
                    <button key={i} onClick={() => onAnswer(q.id, letter)}
                      className={`flex items-center space-x-4 p-4 rounded-xl border text-left transition-all ${isSelected ? 'border-[#cba36b] bg-[#cba36b]/10 text-[#e0d8cd]' : 'border-[#2a2522] hover:border-[#cba36b]/40 text-[#8a7b6b]'}`}>
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 ${isSelected ? 'border-[#cba36b] bg-[#cba36b] text-[#0d0c0b]' : 'border-[#2a2522]'}`}>{letter}</div>
                      <span className="text-sm">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center mt-4">
              <button onClick={() => setCurrent(s => Math.max(s - 1, 0))} disabled={current === 0}
                className="px-5 py-2.5 border border-[#2a2522] rounded-lg text-sm text-[#8a7b6b] hover:text-[#e0d8cd] hover:bg-[#161311] disabled:opacity-40 transition-colors">
                ← Prev
              </button>
              {current === questions.length - 1 ? (
                <button onClick={onNext}
                  className="px-6 py-2.5 bg-[#cba36b] text-[#0d0c0b] rounded-lg text-sm font-bold hover:bg-[#d9ba88] transition-colors flex items-center">
                  Proceed to Coding <ArrowRight size={16} className="ml-2" />
                </button>
              ) : (
                <button onClick={() => setCurrent(s => Math.min(s + 1, questions.length - 1))}
                  className="px-5 py-2.5 bg-[#cba36b] text-[#0d0c0b] rounded-lg text-sm font-bold hover:bg-[#d9ba88] transition-colors">
                  Next →
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ── Coding Section ────────────────────────────────────────────────────────────
function CodingSection({ questions, scores, onScoreChange, onFinish, topic, timer, paused, onTogglePause }) {
  const [current, setCurrent] = useState(0);
  const q = questions[current];

  const diffColor = {
    Easy: 'text-green-400 border-green-900/50 bg-green-900/20',
    Medium: 'text-amber-400 border-amber-900/50 bg-amber-900/20',
    Hard: 'text-red-400 border-red-900/50 bg-red-900/20',
  };

  const statusOptions = ['Solved', 'Partially Solved', 'Attempted', 'Skipped'];
  const statusColors = {
    'Solved': 'border-green-500 bg-green-500/10 text-green-400',
    'Partially Solved': 'border-amber-500 bg-amber-500/10 text-amber-400',
    'Attempted': 'border-blue-500 bg-blue-500/10 text-blue-400',
    'Skipped': 'border-[#2a2522] bg-transparent text-[#8a7b6b]',
  };

  return (
    <div className="flex h-screen bg-[#0d0c0b] text-[#e0d8cd] font-sans overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#cba36b]">Coding Challenge</h1>
            <p className="text-xs text-[#8a7b6b] mt-0.5 flex items-center"><BookOpen size={11} className="mr-1" /> Topic: {topic || 'General'}</p>
          </div>
          <div className="flex items-center space-x-3">
            <TimerDisplay seconds={timer} />
            <button onClick={onTogglePause} className="flex items-center space-x-1 text-xs text-[#8a7b6b] hover:text-[#e0d8cd] border border-[#2a2522] px-3 py-1.5 rounded-lg">
              {paused ? <PlayCircle size={12} /> : <PauseCircle size={12} />}
              <span>{paused ? 'Resume' : 'Pause'}</span>
            </button>
          </div>
        </div>

        {/* Problem Tabs */}
        <div className="flex space-x-2 mb-6">
          {questions.map((qq, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${current === i ? 'border-[#cba36b] text-[#cba36b] bg-[#cba36b]/10' : 'border-[#2a2522] text-[#8a7b6b] hover:text-[#e0d8cd]'}`}>
              {qq.difficulty}
              {scores[qq.title]?.status && scores[qq.title].status !== 'Skipped' && <CheckCircle size={10} className="inline ml-1 text-green-400" />}
            </button>
          ))}
        </div>

        {/* Problem Card */}
        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 mb-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <h2 className="text-lg font-bold text-[#e0d8cd]">{q.title}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${diffColor[q.difficulty]}`}>{q.difficulty}</span>
                </div>
              </div>

              <a href={q.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center space-x-2 bg-[#0d0c0b] border border-[#cba36b]/40 hover:border-[#cba36b] text-[#cba36b] hover:text-[#e0d8cd] px-5 py-3 rounded-xl text-sm font-semibold transition-all group mb-6">
                <Code size={16} />
                <span>Open on LeetCode</span>
                <ExternalLink size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>

              <div className="border-t border-[#2a2522] pt-5">
                <p className="text-sm font-medium text-[#e0d8cd] mb-3">After attempting, report your result:</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {statusOptions.map(status => {
                    const isSelected = scores[q.title]?.status === status;
                    return (
                      <button key={status}
                        onClick={() => onScoreChange(q.title, { ...scores[q.title], status })}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${isSelected ? statusColors[status] : 'border-[#2a2522] text-[#8a7b6b] hover:text-[#e0d8cd]'}`}>
                        {status}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center space-x-3">
                  <label className="text-xs text-[#8a7b6b] shrink-0">Time taken (minutes):</label>
                  <input type="number" min="0" max="120"
                    value={scores[q.title]?.time || ''}
                    onChange={e => onScoreChange(q.title, { ...scores[q.title], time: Number(e.target.value) })}
                    className="w-24 bg-[#0d0c0b] border border-[#2a2522] text-[#e0d8cd] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#cba36b]"
                    placeholder="e.g. 25" />
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <button onClick={onFinish}
          className="w-full py-3.5 bg-green-700 hover:bg-green-600 text-white rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-colors">
          <CheckCircle size={16} />
          <span>Finish & See Results</span>
        </button>
      </div>
    </div>
  );
}

// ── Results Page ──────────────────────────────────────────────────────────────
function ResultsPage({ assessment, aptAnswers, codingScores, aptTimeSpent, codingTimeSpent, aiExplanations, setAiExplanations, loadingExplain, setLoadingExplain, fetchingExplainRef, onClose }) {
  const [evalStatus, setEvalStatus] = useState('pending');
  const [expandedQ, setExpandedQ] = useState(null);

  // Submit on mount
  useEffect(() => {
    const mistakesPayload = assessment.aptitude
      .filter(q => aptAnswers[q.id] && aptAnswers[q.id] !== q.answer)
      .map(q => ({
        question: q.question,
        options: q.options,
        correct_answer: q.answer
      }));

    fetchAuth(`${import.meta.env.VITE_API_URL || \'http://localhost:8000\'}/api/assessment/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        aptAnswers, 
        codingScores, 
        aptTime: aptTimeSpent, 
        codingTime: codingTimeSpent,
        mistakes: mistakesPayload
      })
    }).catch(err => console.error('Submission failed', err));

    const poll = setInterval(async () => {
      try {
        const res = await fetchAuth(`${import.meta.env.VITE_API_URL || \'http://localhost:8000\'}/api/assessment/eval_status`);
        const data = await res.json();
        if (data.status === 'done' || data.status === 'failed') {
          setEvalStatus(data.status);
          clearInterval(poll);
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  // Fetch AI explanation on expand (if not already pre-fetched)
  const handleExpand = async (q) => {
    const userAns = aptAnswers[q.id];
    const isCorrect = userAns === q.answer;
    if (isCorrect) return;
    const alreadyExpanded = expandedQ === q.id;
    setExpandedQ(alreadyExpanded ? null : q.id);
    if (!alreadyExpanded && !aiExplanations[q.id] && !loadingExplain[q.id] && !fetchingExplainRef.current[q.id]) {
      fetchingExplainRef.current[q.id] = true;
      setLoadingExplain(prev => ({ ...prev, [q.id]: true }));
      try {
        const res = await fetchAuth(`${import.meta.env.VITE_API_URL || \'http://localhost:8000\'}/api/assessment/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q.question,
            options: q.options,
            correct_answer: q.answer,
            user_answer: userAns || 'Not answered'
          })
        });
        const data = await res.json();
        setAiExplanations(prev => ({ ...prev, [q.id]: data.explanation }));
      } catch {
        setAiExplanations(prev => ({ ...prev, [q.id]: q.explanation || 'Explanation unavailable.' }));
      } finally {
        setLoadingExplain(prev => ({ ...prev, [q.id]: false }));
      }
    }
  };

  const total = assessment.aptitude.length;
  const correct = assessment.aptitude.filter(q => aptAnswers[q.id] === q.answer).length;
  const score = Math.round((correct / total) * 100);

  const sectionStats = [...new Set(assessment.aptitude.map(q => q.section))].map(sec => {
    const qs = assessment.aptitude.filter(q => q.section === sec);
    const c = qs.filter(q => aptAnswers[q.id] === q.answer).length;
    return { sec, correct: c, total: qs.length };
  });

  return (
    <div className="flex h-screen bg-[#0d0c0b] text-[#e0d8cd] font-sans overflow-y-auto custom-scrollbar">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto px-8 py-10">

        {/* Skill Update Banner */}
        <AnimatePresence>
          {evalStatus === 'pending' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="mb-5 bg-amber-950/40 border border-amber-400/30 rounded-xl px-4 py-3 flex items-center space-x-3">
              <RefreshCw size={16} className="text-amber-400 animate-spin shrink-0" />
              <p className="text-amber-300 text-sm">AI is evaluating your performance and updating your skills... this may take a minute.</p>
            </motion.div>
          )}
          {evalStatus === 'done' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="mb-5 bg-green-950/40 border border-green-500/30 rounded-xl px-4 py-3 flex items-center space-x-3">
              <CheckCircle size={16} className="text-green-400 shrink-0" />
              <p className="text-green-300 text-sm">Skills updated! Your Skill Board now reflects your latest performance.</p>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Score Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 mb-4 ${score >= 70 ? 'border-green-400 bg-green-900/20' : score >= 40 ? 'border-amber-400 bg-amber-900/20' : 'border-red-400 bg-red-900/20'}`}>
            <span className={`text-3xl font-bold ${score >= 70 ? 'text-green-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{score}%</span>
          </div>
          <h1 className="text-2xl font-bold text-[#e0d8cd]">Assessment Complete!</h1>
          <p className="text-[#8a7b6b] text-sm mt-1">{correct} of {total} aptitude questions correct</p>
        </div>

        {/* Section Breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {sectionStats.map(({ sec, correct: c, total: t }) => (
            <div key={sec} className="bg-[#161311] border border-[#2a2522] rounded-xl p-4 text-center">
              <p className="text-xs text-[#8a7b6b] mb-1">{sec}</p>
              <p className="text-2xl font-bold text-[#cba36b]">{c}/{t}</p>
            </div>
          ))}
        </div>

        {/* Aptitude Review — collapsible */}
        <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 mb-5">
          <h3 className="font-semibold text-[#e0d8cd] mb-4 flex items-center">
            <Brain size={16} className="mr-2 text-purple-400" /> Aptitude Review
          </h3>
          <div className="space-y-2">
              {assessment.aptitude.map(q => {
              const userAns = aptAnswers[q.id];
              const isCorrect = userAns === q.answer;
              const correctIdx = ['A','B','C','D'].indexOf(q.answer);
              const correctText = q.options[correctIdx] || q.answer;
              const userIdx = userAns ? ['A','B','C','D'].indexOf(userAns) : -1;
              const userText = userIdx >= 0 ? q.options[userIdx] : null;
              const isExpanded = expandedQ === q.id;
              const explanationToShow = aiExplanations[q.id] || q.explanation;

              return (
                <div key={q.id} className={`rounded-xl border overflow-hidden ${isCorrect ? 'border-green-900/40' : 'border-red-900/40'}`}>
                  <button
                    onClick={() => handleExpand(q)}
                    className={`w-full flex items-start justify-between p-4 text-left transition-colors ${isCorrect ? 'bg-green-900/10 hover:bg-green-900/20' : 'bg-red-900/10 hover:bg-red-900/20'}`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className={`mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${isCorrect ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {isCorrect ? 'Correct' : 'Wrong'}
                      </span>
                      <p className="text-xs text-[#e0d8cd] leading-relaxed">[{q.id}] {q.question}</p>
                    </div>
                    {!isCorrect && (isExpanded ? <ChevronDown size={14} className="text-[#8a7b6b] shrink-0 mt-1" /> : <ChevronRight size={14} className="text-[#8a7b6b] shrink-0 mt-1" />)}
                  </button>

                  {isExpanded && !isCorrect && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-t border-red-900/30 bg-[#0d0c0b] px-4 py-4">
                      <div className="space-y-2 text-xs">
                        <p className="text-[#8a7b6b]">Your answer: <span className="text-red-400 font-semibold">{userAns ? `${userAns}. ${userText}` : 'Not answered'}</span></p>
                        <p className="text-[#8a7b6b]">Correct answer: <span className="text-green-400 font-semibold">{q.answer}. {correctText}</span></p>
                        <div className="mt-3 p-3 bg-[#1e1916] rounded-lg border border-[#2a2522]">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] uppercase tracking-widest text-[#8a7b6b]">Explanation</p>
                            {loadingExplain[q.id] && <RefreshCw size={10} className="text-[#cba36b] animate-spin" />}
                            {!loadingExplain[q.id] && aiExplanations[q.id] && (
                              <span className="text-[9px] text-purple-400 border border-purple-400/30 px-1.5 py-0.5 rounded">AI Generated</span>
                            )}
                          </div>
                          {loadingExplain[q.id] ? (
                            <p className="text-[#8a7b6b] italic">Asking qwen3:8b for explanation...</p>
                          ) : (
                            <p className="text-[#e0d8cd] leading-relaxed">{explanationToShow || 'Loading explanation...'}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Coding Summary */}
        <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-[#e0d8cd] mb-3 flex items-center">
            <Code size={16} className="mr-2 text-[#cba36b]" /> Coding Results
          </h3>
          <div className="space-y-2">
            {assessment.coding.map(q => {
              const s = codingScores[q.title];
              const statusColorMap = {
                'Solved': 'bg-green-900/30 text-green-400',
                'Partially Solved': 'bg-amber-900/30 text-amber-400',
                'Attempted': 'bg-blue-900/30 text-blue-400',
                'Skipped': 'bg-[#2a2522] text-[#8a7b6b]',
              };
              return (
                <div key={q.title} className="p-4 bg-[#0d0c0b] border border-[#2a2522] rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#e0d8cd] font-medium text-sm">{q.title}</span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.difficulty === 'Easy' ? 'bg-green-900/30 text-green-400' : q.difficulty === 'Medium' ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400'}`}>{q.difficulty}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColorMap[s?.status] || 'bg-[#2a2522] text-[#8a7b6b]'}`}>{s?.status || 'Not reported'}</span>
                    </div>
                  </div>
                  {s?.time > 0 && <p className="text-xs text-[#8a7b6b]">Time taken: {s.time} min</p>}
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={onClose} className="w-full py-4 bg-[#cba36b] text-[#0d0c0b] rounded-xl font-bold hover:bg-[#d9ba88] transition-colors">
          Back to Dashboard
        </button>
      </motion.div>
    </div>
  );
}

// ── Root Assessment Component ──────────────────────────────────────────────────
export default function Assessment({ onClose, isInitial, onComplete }) {
  const [phase, setPhase] = useState('instructions');
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState(null);

  const aptTotalSecs  = isInitial ? INITIAL_APT_SECS  : REGULAR_APT_SECS;
  const codeTotalSecs = isInitial ? INITIAL_CODE_SECS : REGULAR_CODE_SECS;

  // Aptitude state
  const [aptAnswers, setAptAnswers]   = useState({});
  const [aptTimer, setAptTimer]       = useState(aptTotalSecs);
  const [aptPaused, setAptPaused]     = useState(false);
  const aptStartRef = useRef(null);     // wall-clock start time

  // Coding state
  const [codingScores, setCodingScores]   = useState({});
  const [codingTimer, setCodingTimer]     = useState(codeTotalSecs);
  const [codingPaused, setCodingPaused]   = useState(false);
  const codeStartRef = useRef(null);

  // Pre-fetch Explanations state
  const [aiExplanations, setAiExplanations] = useState({});
  const [loadingExplain, setLoadingExplain] = useState({});
  const fetchingExplainRef = useRef({});

  // Pre-fetch explanations as the user selects wrong answers during the test
  useEffect(() => {
    if (!assessment || phase !== 'aptitude') return;
    assessment.aptitude.forEach(q => {
      const userAns = aptAnswers[q.id];
      if (userAns && userAns !== q.answer && !fetchingExplainRef.current[q.id] && !aiExplanations[q.id]) {
        fetchingExplainRef.current[q.id] = true;
        setLoadingExplain(prev => ({ ...prev, [q.id]: true }));
        fetchAuth(`${import.meta.env.VITE_API_URL || \'http://localhost:8000\'}/api/assessment/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q.question,
            options: q.options,
            correct_answer: q.answer,
            user_answer: userAns
          })
        })
          .then(res => res.json())
          .then(data => { setAiExplanations(prev => ({ ...prev, [q.id]: data.explanation })); })
          .catch(() => { setAiExplanations(prev => ({ ...prev, [q.id]: q.explanation || 'Explanation unavailable.' })); })
          .finally(() => { setLoadingExplain(prev => ({ ...prev, [q.id]: false })); });
      }
    });
  }, [aptAnswers, assessment, phase, aiExplanations]);

  // Track actual time spent (total secs - remaining)
  const aptTimeSpent  = aptTotalSecs  - aptTimer;
  const codeTimeSpent = codeTotalSecs - codingTimer;

  // Aptitude countdown → auto-advance when hits 0
  useEffect(() => {
    if (phase !== 'aptitude' || aptPaused) return;
    if (!aptStartRef.current) aptStartRef.current = Date.now();
    if (aptTimer <= 0) { setPhase('coding'); return; }
    const id = setTimeout(() => setAptTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, aptTimer, aptPaused]);

  // Coding countdown → auto-advance to results when hits 0
  useEffect(() => {
    if (phase !== 'coding' || codingPaused) return;
    if (!codeStartRef.current) codeStartRef.current = Date.now();
    if (codingTimer <= 0) { setPhase('results'); return; }
    const id = setTimeout(() => setCodingTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, codingTimer, codingPaused]);

  const handleProceed = async () => {
    setPhase('loading');

    if (isInitial) {
      try {
        const res = await fetchAuth(`${import.meta.env.VITE_API_URL || \'http://localhost:8000\'}/api/assessment/initial`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        // Ensure aptitude questions have section tags
        const apt = (data.aptitude || []).map(q => ({
          ...q,
          section: q.section || (q.id?.includes('APT') ? detectSection(q.id) : 'Verbal')
        }));
        setAssessment({ ...data, aptitude: apt, topic: 'Baseline' });
        setPhase('aptitude');
      } catch (e) {
        setError(e.message);
        setPhase('error');
      }
      return;
    }

    try {
      const res = await fetchAuth(`${import.meta.env.VITE_API_URL || \'http://localhost:8000\'}/api/assessment/generate`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAssessment(data);
      setPhase('aptitude');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  // Helper: detect section from question id prefix
  const detectSection = (id = '') => {
    if (id.includes('VER') || id.includes('-V-')) return 'Verbal';
    if (id.includes('QUA') || id.includes('-Q-')) return 'Quantitative';
    return 'Logical';
  };

  if (phase === 'instructions') {
    return isInitial
      ? <InitialInstructionsPage onProceed={handleProceed} onBack={onClose} />
      : <RegularInstructionsPage onProceed={handleProceed} onBack={onClose} />;
  }
  if (phase === 'loading') return <LoadingPage topic={null} />;
  if (phase === 'error') return (
    <div className="flex h-screen bg-[#0d0c0b] items-center justify-center text-center p-8">
      <div>
        <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-xl text-[#e0d8cd] mb-2">Failed to Generate Assessment</h2>
        <p className="text-sm text-[#8a7b6b] mb-6 max-w-sm">{error}</p>
        <div className="flex space-x-3 justify-center">
          <button onClick={handleProceed} className="px-5 py-2 bg-[#cba36b] text-[#0d0c0b] rounded-lg font-bold hover:bg-[#d9ba88] flex items-center space-x-2">
            <RefreshCw size={14} /><span>Retry</span>
          </button>
          <button onClick={onClose} className="px-5 py-2 border border-[#2a2522] text-[#8a7b6b] rounded-lg hover:text-[#e0d8cd]">Cancel</button>
        </div>
      </div>
    </div>
  );
  if (phase === 'aptitude') return (
    <AptitudeSection
      questions={assessment.aptitude}
      answers={aptAnswers}
      onAnswer={(id, letter) => setAptAnswers(prev => ({ ...prev, [id]: letter }))}
      onNext={() => setPhase('coding')}
      timer={aptTimer}
      paused={aptPaused}
      onTogglePause={() => setAptPaused(p => !p)}
    />
  );
  if (phase === 'coding') return (
    <CodingSection
      questions={assessment.coding}
      scores={codingScores}
      onScoreChange={(title, val) => setCodingScores(prev => ({ ...prev, [title]: val }))}
      onFinish={() => setPhase('results')}
      topic={assessment.topic}
      timer={codingTimer}
      paused={codingPaused}
      onTogglePause={() => setCodingPaused(p => !p)}
    />
  );
  if (phase === 'results') return (
    <ResultsPage
      assessment={assessment}
      aptAnswers={aptAnswers}
      codingScores={codingScores}
      aptTimeSpent={aptTimeSpent}
      codingTimeSpent={codeTimeSpent}
      aiExplanations={aiExplanations}
      setAiExplanations={setAiExplanations}
      loadingExplain={loadingExplain}
      setLoadingExplain={setLoadingExplain}
      fetchingExplainRef={fetchingExplainRef}
      onClose={() => { if (onComplete) onComplete(); onClose(); }}
    />
  );
  return null;
}
