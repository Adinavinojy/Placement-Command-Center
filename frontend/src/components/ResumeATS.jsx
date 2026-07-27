import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileSearch, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchAuth, API_BASE } from '../api';

export default function ResumeATS() {
    const [jobDescription, setJobDescription] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState('');

    const handleScan = async () => {
        if (!jobDescription.trim()) {
            setError('Please paste a Job Description first.');
            return;
        }
        
        setError('');
        setIsScanning(true);
        setReport(null);
        
        try {
            const res = await fetchAuth(`${API_BASE}/api/ats/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_description: jobDescription })
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Failed to scan ATS');
            }
            
            const data = await res.json();
            setReport(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8">
            <h2 className="text-3xl font-black text-[#e0d8cd] tracking-tight mb-2">Resume ATS Matcher</h2>
            <p className="text-[#8a7b6b] mb-8">Paste the Job Description below to see how your uploaded CV matches the ATS criteria.</p>
            
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 flex items-center">
                    <AlertCircle size={20} className="mr-2 flex-shrink-0" />
                    {error}
                </div>
            )}
            
            <div className="bg-[#161311] border border-[#2a2522] rounded-2xl p-6 mb-8 shadow-xl">
                <label className="block text-sm font-bold text-[#8a7b6b] mb-2 uppercase tracking-wider">Job Description</label>
                <textarea 
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full h-48 bg-[#0d0c0b] border border-[#2a2522] rounded-xl p-4 text-[#e0d8cd] focus:outline-none focus:border-[#cba36b] transition-colors resize-none font-mono text-sm leading-relaxed"
                    placeholder="Paste the target job description here..."
                />
                <div className="mt-4 flex justify-end">
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
    );
}
