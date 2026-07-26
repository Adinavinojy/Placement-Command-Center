import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchAuth } from '../api';
import { AlertTriangle, Clock, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';

export default function MistakesView() {
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState({});

  useEffect(() => {
    fetchAuth(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/mistakes`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setMistakes(data.mistakes || []);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const toggleDate = (dateStr) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  // Group by date (ignoring time)
  const grouped = mistakes.reduce((acc, m) => {
    const d = new Date(m.date).toLocaleDateString();
    if (!acc[d]) acc[d] = [];
    acc[d].push(m);
    return acc;
  }, {});

  if (loading) return <div className="p-8 text-[#8a7b6b] animate-pulse">Loading mistakes...</div>;
  if (mistakes.length === 0) return (
    <div className="p-8 flex flex-col items-center justify-center text-[#8a7b6b] h-full space-y-4">
      <CheckCircle2 size={48} className="text-green-500/50" />
      <p>No mistakes recorded yet! Great job.</p>
    </div>
  );

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto custom-scrollbar overflow-y-auto h-full pb-32">
      <div className="flex items-center space-x-3 mb-6">
        <AlertTriangle className="text-yellow-500" size={28} />
        <h2 className="text-2xl font-bold text-white">Mistakes Tracker</h2>
      </div>
      
      {Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a)).map(dateStr => (
        <div key={dateStr} className="space-y-4">
          <div 
            onClick={() => toggleDate(dateStr)}
            className="flex items-center space-x-2 text-[#cba36b] font-semibold sticky top-0 bg-[#0d0c0b] py-2 z-10 cursor-pointer hover:text-white transition-colors"
          >
            {expandedDates[dateStr] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Clock size={16} />
            <span>{dateStr} ({grouped[dateStr].length} mistakes)</span>
          </div>
          
          {expandedDates[dateStr] && (
            <div className="grid gap-4">
              {grouped[dateStr].map((m, idx) => (
                <motion.div 
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#1a1714] border border-[#2a2522] rounded-xl p-5 shadow-lg"
                >
                  <p className="text-white font-medium mb-4">{m.question}</p>
                  <div className="space-y-2">
                    {m.options.map((opt, oIdx) => {
                      const optionLetter = String.fromCharCode(65 + oIdx);
                      const isCorrect = opt === m.correct_answer || optionLetter === m.correct_answer;
                      return (
                        <div 
                          key={oIdx} 
                          className={`px-4 py-2 rounded-lg text-sm flex items-center justify-between
                            ${isCorrect 
                              ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
                              : 'bg-[#0d0c0b] border border-[#2a2522] text-[#8a7b6b]'
                            }
                          `}
                        >
                          <span>{opt}</span>
                          {isCorrect && <CheckCircle2 size={16} className="text-green-400" />}
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
