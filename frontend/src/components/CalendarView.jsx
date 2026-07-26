import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Clock, Building } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CalendarView({ dashboardData, onEventAdded }) {
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Set to 1st of month
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  const [newEvent, setNewEvent] = useState({ title: '', company: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOffset = currentDate.getDay(); // 0 = Sunday

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const offsetArray = Array.from({ length: firstDayOffset }, () => null);
  
  const gridCells = [...offsetArray, ...daysArray];

  // Helper to get deadlines for a specific date
  const getDeadlinesForDate = (dateObj) => {
    if (!dashboardData?.deadlines) return [];
    return dashboardData.deadlines.filter(d => {
      const dDate = new Date(d.due_at);
      return dDate.getDate() === dateObj.getDate() &&
             dDate.getMonth() === dateObj.getMonth() &&
             dDate.getFullYear() === dateObj.getFullYear();
    });
  };

  const handleCellClick = (day) => {
    if (!day) return;
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    clickedDate.setHours(0, 0, 0, 0);
    setSelectedDate(clickedDate);
    setShowModal(true);
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.company || !selectedDate) return;
    setIsSubmitting(true);
    try {
      // Format selectedDate to YYYY-MM-DD
      const dateStr = selectedDate.getFullYear() + "-" + 
                      String(selectedDate.getMonth() + 1).padStart(2, '0') + "-" + 
                      String(selectedDate.getDate()).padStart(2, '0');
                      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newEvent.title,
          company: newEvent.company,
          date: dateStr
        })
      });
      if (res.ok) {
        setNewEvent({ title: '', company: '' });
        setShowModal(false);
        if (onEventAdded) onEventAdded();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 glass-panel rounded-2xl flex flex-col bg-[#161311] overflow-hidden">
      
      {/* Header */}
      <div className="px-6 py-3 border-b border-[#2a2522] flex justify-between items-center bg-[#1e1916]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full border border-[#2a2522] flex items-center justify-center text-[#cba36b] bg-[#0d0c0b]">
            <CalendarIcon size={20} />
          </div>
          <h2 className="text-xl font-medium text-[#e0d8cd]">Calendar & Schedule</h2>
        </div>
        
        <div className="flex items-center space-x-6">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#2a2522] text-[#8a7b6b] hover:text-[#e0d8cd] transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-medium text-[#cba36b] w-40 text-center">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#2a2522] text-[#8a7b6b] hover:text-[#e0d8cd] transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-7 gap-2 lg:gap-3">
          {/* Days of week */}
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
            <div key={day} className="text-center text-xs font-semibold tracking-wider text-[#8a7b6b] mb-2">
              {day}
            </div>
          ))}
          
          {/* Calendar Cells */}
          {gridCells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="aspect-square rounded-xl border border-transparent"></div>;
            
            const thisCellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            thisCellDate.setHours(0, 0, 0, 0);
            
            const isToday = thisCellDate.getTime() === today.getTime();
            const isPast = thisCellDate.getTime() < today.getTime();
            
            const dayDeadlines = getDeadlinesForDate(thisCellDate);
            
            return (
              <div 
                key={day} 
                onClick={() => handleCellClick(day)}
                className={`aspect-square w-full rounded-xl p-2 flex flex-col items-center justify-center border transition-all cursor-pointer group
                  ${isToday ? 'border-[#cba36b] bg-[#1e1916] shadow-[0_0_15px_rgba(203,163,107,0.15)]' : 
                    dayDeadlines.length > 0 ? 'border-[#cba36b]/30 bg-[#cba36b]/5 hover:bg-[#cba36b]/10' : 
                    'border-[#2a2522] bg-[#0d0c0b] hover:border-[#cba36b]/50 hover:bg-[#161311]'}
                  ${isPast && !isToday ? 'opacity-50' : ''}
                `}
              >
                <span className={`text-lg font-semibold w-10 h-10 flex items-center justify-center rounded-full mb-2 ${isToday ? 'bg-[#cba36b] text-[#0d0c0b]' : 'text-[#8a7b6b] group-hover:text-[#e0d8cd]'}`}>
                  {day}
                </span>
                
                <span className={`text-xs font-medium tracking-wide ${dayDeadlines.length > 0 ? 'text-[#cba36b] opacity-70' : 'opacity-0 select-none'}`}>
                  [{dayDeadlines.length > 0 ? dayDeadlines.length : '0'}]
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-panel w-full max-w-md bg-[#161311] rounded-2xl overflow-hidden border border-[#cba36b]/30 shadow-[0_0_30px_rgba(203,163,107,0.15)]"
            >
              <div className="p-6 border-b border-[#2a2522] flex justify-between items-center bg-[#1e1916]">
                <div>
                  <h3 className="text-lg font-medium text-[#e0d8cd]">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  {selectedDate.getTime() === today.getTime() && (
                    <span className="text-xs bg-[#cba36b] text-[#0d0c0b] px-2 py-0.5 rounded-full font-bold mt-1 inline-block">TODAY</span>
                  )}
                </div>
                <button onClick={() => setShowModal(false)} className="text-[#8a7b6b] hover:text-[#e0d8cd] p-1 rounded-full hover:bg-[#2a2522] transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-[#8a7b6b] uppercase tracking-wider mb-3">Scheduled Events</h4>
                  {getDeadlinesForDate(selectedDate).length > 0 ? (
                    <div className="space-y-3">
                      {getDeadlinesForDate(selectedDate).map((d, i) => (
                        <div key={i} className="p-3 bg-[#0d0c0b] border border-[#2a2522] rounded-xl">
                          <div className="flex justify-between">
                            <span className="font-medium text-[#e0d8cd]">{d.company}</span>
                            {d.role && d.role !== "Role" && <span className="text-xs text-[#8a7b6b] bg-[#1e1916] px-2 py-0.5 rounded border border-[#2a2522]">{d.role}</span>}
                          </div>
                          <p className="text-sm text-[#8a7b6b] mt-1">{d.title}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[#8a7b6b] text-sm italic border border-[#2a2522] border-dashed rounded-xl">
                      No events scheduled for this day.
                    </div>
                  )}
                </div>

                {selectedDate.getTime() >= today.getTime() && (
                  <div>
                    <h4 className="text-xs font-semibold text-[#8a7b6b] uppercase tracking-wider mb-3 flex items-center">
                      <Plus size={14} className="mr-1" /> Add Manual Event
                    </h4>
                    <form onSubmit={handleAddEvent} className="space-y-4">
                      <div>
                        <label className="block text-xs text-[#8a7b6b] mb-1">Company / Context</label>
                        <input 
                          type="text" 
                          required
                          value={newEvent.company}
                          onChange={e => setNewEvent({...newEvent, company: e.target.value})}
                          placeholder="e.g. Google, College Exam"
                          className="w-full bg-[#0d0c0b] border border-[#2a2522] rounded-lg px-3 py-2 text-sm text-[#e0d8cd] focus:outline-none focus:border-[#cba36b]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8a7b6b] mb-1">Event Title</label>
                        <input 
                          type="text"
                          required
                          value={newEvent.title}
                          onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                          placeholder="e.g. Mock Interview, OA Due"
                          className="w-full bg-[#0d0c0b] border border-[#2a2522] rounded-lg px-3 py-2 text-sm text-[#e0d8cd] focus:outline-none focus:border-[#cba36b]"
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2 bg-[#cba36b] hover:bg-[#d8b584] text-[#0d0c0b] rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? 'Saving...' : 'Save Event'}
                      </button>
                    </form>
                  </div>
                )}
                
                {selectedDate.getTime() < today.getTime() && (
                  <div className="text-center py-3 bg-[#0d0c0b] text-[#8a7b6b] text-xs rounded-lg border border-[#2a2522]">
                    Past dates cannot be edited.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
