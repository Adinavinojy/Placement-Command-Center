import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileSearch, CheckCircle2, XCircle, AlertCircle, RefreshCw, History, Clock } from 'lucide-react';
import { fetchAuth, API_BASE } from '../api';

export default function ResumeATS() {
    const [companyName, setCompanyName] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState('');
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const fetchHistory = async () => {
        try {
            setLoadingHistory(true);
            const res = await fetchAuth(`${API_BASE}/api/ats/history`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history || []);
            }
        } catch (err) {
            console.error("Failed to fetch ATS history", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleScan = async () => {
        if (!companyName.trim()) {
            setError('Please enter a Company Name.');
            return;
        }
        if (!jobDescription.trim()) {
            setError('Please paste a Job Description.');
            return;
        }
        
        setError('');
        setIsScanning(true);
        setReport(null);
        
        try {
            const res = await fetchAuth(`${API_BASE}/api/ats/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    job_description: jobDescription,
                    company_name: companyName 
                })
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Failed to scan ATS');
            }
            
            const data = await res.json();
            setReport(data);
            fetchHistory(); // Refresh history after successful scan
        } catch (err) {
            setError(err.message);
        } finally {
            setIsScanning(false);
        }
    };

    const loadHistoryReport = (pastReport) => {
        setReport(pastReport);
        setCompanyName(pastReport.company_name || '');
        setJobDescription(pastReport.job_description || '');
        setError('');
    };

    return (
        <div className="max-w-6xl mx-auto py-8 flex flex-col md:flex-row gap-8 w-full">
            
            {/* Left Sidebar: History */}
            <div className="w-full md:w-1/4 flex flex-col">
                <div className="flex items-center space-x-2 mb-6">
                    <History className="text-[#cba36b]" size={20} />
                    <h3 className="text-xl font-bold text-[#e0d8cd]">Saved Scans</h3>
                </div>
                
                <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-4 flex-1 overflow-y-auto max-h-[70vh] custom-scrollbar shadow-xl">
                    {loadingHistory ? (
                        <div className="flex justify-center py-8">
                            <RefreshCw size={20} className="animate-spin text-[#8a7b6b]" />
                        </div>
                    ) : history.length > 0 ? (
                        <div className="space-y-3">
                            {history.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => loadHistoryReport(item)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${report?.timestamp === item.timestamp ? 'bg-[#cba36b]/10 border-[#cba36b]/40' : 'bg-[#0d0c0b] border-[#2a2522] hover:border-[#cba36b]/30'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-[#e0d8cd] truncate pr-2">{item.company_name || 'Unknown'}</h4>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${item.match_score > 70 ? 'bg-green-500/10 text-green-400' : item.match_score > 40 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {item.match_score}%
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-[#8a7b6b] flex items-center">
                                        <Clock size={10} className="mr-1" />
                                        {new Date(item.timestamp * 1000).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-[#8a7b6b]">
                            <p className="text-sm">No saved scans yet.</p>
                            <p className="text-xs mt-1">Scan a job description to see it here.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Area: Main Scanner */}
            <div className="w-full md:w-3/4 flex flex-col">
                <h2 className="text-3xl font-black text-[#e0d8cd] tracking-tight mb-2">Resume ATS Matcher</h2>
                <p className="text-[#8a7b6b] mb-8">Enter the company and job description below to analyze your uploaded CV.</p>
                
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 flex items-center">
                        <AlertCircle size={20} className="mr-2 flex-shrink-0" />
                        {error}
                    </div>
                )}
                
                <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 mb-8 shadow-xl">
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-[#8a7b6b] mb-2 uppercase tracking-wider">Company Name</label>
                        <input 
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full bg-[#0d0c0b] border border-[#2a2522] rounded-xl p-3 text-[#e0d8cd] focus:outline-none focus:border-[#cba36b] transition-colors"
                            placeholder="e.g. Google, Amazon, TCS..."
                        />
                    </div>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-[#8a7b6b] mb-2 uppercase tracking-wider">Job Description</label>
                        <textarea 
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            className="w-full h-48 bg-[#0d0c0b] border border-[#2a2522] rounded-xl p-4 text-[#e0d8cd] focus:outline-none focus:border-[#cba36b] transition-colors resize-none font-mono text-sm leading-relaxed custom-scrollbar"
                            placeholder="Paste the target job description here..."
                        />
                    </div>
                    
                    <div className="flex justify-end">
                        <button 
                            onClick={handleScan}
                            disabled={isScanning}
                            className="flex items-center space-x-2 bg-[#cba36b] text-[#0d0c0b] px-6 py-3 rounded-xl font-bold hover:bg-[#e0d8cd] transition-all disabled:opacity-50"
                        >
                            {isScanning ? <RefreshCw size={18} className="animate-spin" /> : <FileSearch size={18} />}
                            <span>{isScanning ? 'Scanning...' : 'Scan CV'}</span>
                        </button>
                    </div>
                </div>
                
                {report && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                        <div className="md:col-span-1 bg-[#161311] border border-[#2a2522] rounded-2xl p-6 flex flex-col items-center justify-center shadow-xl">
                            <div className="relative">
                                <svg className="w-32 h-32" viewBox="0 0 36 36">
                                    <path className="text-[#2a2522]" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3"></path>
                                    <path className={`${report.match_score > 70 ? 'text-green-500' : report.match_score > 40 ? 'text-yellow-500' : 'text-red-500'}`} strokeDasharray={`${report.match_score}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3"></path>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-3xl font-black text-[#e0d8cd]">{report.match_score}%</span>
                                    <span className="text-xs text-[#8a7b6b] uppercase tracking-wider font-bold">Match</span>
                                </div>
                            </div>
                            <p className="text-center text-sm text-[#8a7b6b] mt-4 font-medium">{report.match_score > 70 ? 'Excellent match! Your CV is well-tailored.' : report.match_score > 40 ? 'Good start, but needs more targeted keywords.' : 'Needs significant rewriting to pass ATS.'}</p>
                        </div>
                        
                        <div className="md:col-span-2 space-y-6">
                            <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 shadow-xl">
                                <h3 className="text-sm font-bold text-[#8a7b6b] uppercase tracking-wider mb-4 flex items-center">
                                    <CheckCircle2 size={16} className="text-green-500 mr-2" />
                                    Matching Keywords
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {report.matching_keywords?.length > 0 ? report.matching_keywords.map((kw, i) => (
                                        <span key={i} className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-bold">{kw}</span>
                                    )) : <span className="text-sm text-[#8a7b6b]">No matches found.</span>}
                                </div>
                            </div>
                            
                            <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 shadow-xl">
                                <h3 className="text-sm font-bold text-[#8a7b6b] uppercase tracking-wider mb-4 flex items-center">
                                    <XCircle size={16} className="text-red-500 mr-2" />
                                    Missing Keywords
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {report.missing_keywords?.length > 0 ? report.missing_keywords.map((kw, i) => (
                                        <span key={i} className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-bold">{kw}</span>
                                    )) : <span className="text-sm text-[#8a7b6b]">You hit all major keywords!</span>}
                                </div>
                            </div>
                        </div>
                        
                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 shadow-xl">
                                <h3 className="text-sm font-bold text-[#8a7b6b] uppercase tracking-wider mb-4">Formatting Feedback</h3>
                                <p className="text-sm text-[#e0d8cd] leading-relaxed">{report.formatting_feedback}</p>
                            </div>
                            <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 shadow-xl">
                                <h3 className="text-sm font-bold text-[#8a7b6b] uppercase tracking-wider mb-4">Actionable Advice</h3>
                                <ul className="space-y-3">
                                    {report.actionable_advice?.map((advice, i) => (
                                        <li key={i} className="flex items-start">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#cba36b] mt-2 mr-3 flex-shrink-0"></span>
                                            <span className="text-sm text-[#e0d8cd] leading-relaxed">{advice}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
