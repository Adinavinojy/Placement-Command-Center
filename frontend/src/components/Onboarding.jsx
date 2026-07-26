import React, { useState, useEffect } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchAuth } from '../api';

export default function Onboarding({ initialData, onComplete }) {
   const [formData, setFormData] = useState({
      name: '',
      email: initialData?.email || '',
      course: '',
      education: '',
      semester: ''
   });
   const [isSubmitting, setIsSubmitting] = useState(false);

   useEffect(() => {
      if (initialData) {
         setFormData(prev => ({
            ...prev,
            email: prev.email || initialData.email || ''
         }));
      }
   }, [initialData]);

   const handleSubmit = async (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
         const response = await fetchAuth(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/profile/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
         });

         if (response.ok) {
            onComplete();
         } else {
            alert('Failed to setup profile.');
         }
      } catch (err) {
         console.error(err);
         alert('Error connecting to backend.');
      }
      setIsSubmitting(false);
   };

   const getSemesterOptions = () => {
      if (formData.course === 'BTech') return 8;
      if (formData.course === 'MTech') return 4;
      if (formData.course === 'BCA') return 6;
      if (formData.course === 'MCA') return 4;
      return 0; // Don't show semester if not applicable
   };

   const semesterCount = getSemesterOptions();

   return (
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         className="fixed inset-0 z-50 flex flex-col bg-[#0d0c0b] text-[#e0d8cd] font-sans"
      >
         <header className="w-full border-b border-[#2a2522] flex items-center justify-between px-12 py-6 bg-[#0d0c0b] z-10 shrink-0">
            <div className="flex items-center space-x-3">
               <span className="text-2xl text-[#cba36b]">✨</span>
               <span className="text-xl font-bold tracking-wider uppercase text-[#cba36b]">Mentor AI</span>
            </div>
            <nav className="flex space-x-12">
               <div className="flex items-center space-x-3 text-[#cba36b]">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border border-[#cba36b] bg-[#cba36b]/10">1</div>
                  <span className="text-sm font-medium">Your Details</span>
               </div>
               <div className="flex items-center space-x-3 text-gray-600">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border border-gray-600"><Lock size={12} /></div>
                  <span className="text-sm font-medium">Locked</span>
               </div>
            </nav>
         </header>

         <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center py-12 px-6">
            <div className="w-full max-w-xl">
               <div className="text-center mb-12">
                  <h1 className="text-4xl font-light mb-4">Let's get to know you</h1>
                  <p className="text-[#8a7b6b] text-lg">We need a few details to personalize your placement journey.</p>
               </div>

               <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                     <label className="block text-sm font-medium text-[#8a7b6b] mb-2">Full Name</label>
                     <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full bg-[#161311] border border-[#2a2522] rounded-xl px-4 py-3 text-[#e0d8cd] focus:outline-none focus:border-[#cba36b] transition-colors"
                     />
                  </div>

                  <div>
                     <label className="block text-sm font-medium text-[#8a7b6b] mb-2">Email Address</label>
                     <input
                        type="email"
                        value={formData.email}
                        disabled
                        className="w-full bg-[#1e1916] border border-[#2a2522] rounded-xl px-4 py-3 text-[#e0d8cd] opacity-70 cursor-not-allowed focus:outline-none"
                     />
                  </div>

                  <div>
                     <label className="block text-sm font-medium text-[#8a7b6b] mb-2">Highest Education</label>
                     <select
                        value={formData.education}
                        onChange={e => setFormData({ ...formData, education: e.target.value })}
                        required
                        className="w-full bg-[#161311] border border-[#2a2522] rounded-xl px-4 py-3 text-[#e0d8cd] focus:outline-none focus:border-[#cba36b] transition-colors appearance-none"
                     >
                        <option value="" disabled>Select Education Level</option>
                        <option value="High School">High School / 12th</option>
                        <option value="Diploma">Diploma</option>
                        <option value="Bachelors">Bachelor's Degree</option>
                        <option value="Masters">Master's Degree</option>
                        <option value="PhD">PhD</option>
                     </select>
                  </div>

                  <div>
                     <label className="block text-sm font-medium text-[#8a7b6b] mb-2">Current Course</label>
                     <select
                        value={formData.course}
                        onChange={e => setFormData({ ...formData, course: e.target.value, semester: '' })}
                        required
                        className="w-full bg-[#161311] border border-[#2a2522] rounded-xl px-4 py-3 text-[#e0d8cd] focus:outline-none focus:border-[#cba36b] transition-colors appearance-none"
                     >
                        <option value="" disabled>Select Course</option>
                        <option value="BTech">B.Tech / B.E.</option>
                        <option value="MTech">M.Tech / M.E.</option>
                        <option value="BCA">BCA</option>
                        <option value="MCA">MCA</option>
                        <option value="BSc">B.Sc</option>
                        <option value="Other">Other</option>
                     </select>
                  </div>

                  {semesterCount > 0 && (
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <label className="block text-sm font-medium text-[#8a7b6b] mb-2">Current Semester</label>
                        <select
                           value={formData.semester}
                           onChange={e => setFormData({ ...formData, semester: e.target.value })}
                           required
                           className="w-full bg-[#161311] border border-[#2a2522] rounded-xl px-4 py-3 text-[#e0d8cd] focus:outline-none focus:border-[#cba36b] transition-colors appearance-none"
                        >
                           <option value="" disabled>Select Semester</option>
                           {[...Array(semesterCount)].map((_, i) => (
                              <option key={i + 1} value={`Semester ${i + 1}`}>Semester {i + 1}</option>
                           ))}
                        </select>
                     </motion.div>
                  )}

                  <div className="pt-8">
                     <p className="text-center text-sm text-[#8a7b6b] mb-6 px-8">
                        Almost there! After completing this, please navigate to <strong className="text-[#cba36b]">Documents</strong> to upload your academic records, and take the Initial <strong className="text-[#cba36b]">Assessment</strong> to unlock your personalized Dashboard.
                     </p>
                     
                     <div className="flex justify-end border-t border-[#2a2522] pt-6">
                        <button
                           type="submit"
                           disabled={isSubmitting}
                           className="flex items-center space-x-2 px-8 py-3 bg-[#cba36b] text-[#0d0c0b] rounded-xl font-bold hover:bg-[#e0d8cd] transition-colors disabled:opacity-50"
                        >
                           <span>{isSubmitting ? 'Saving...' : 'Complete Profile'}</span>
                           <ArrowRight size={18} />
                        </button>
                     </div>
                  </div>
               </form>
            </div>
         </main>
      </motion.div>
   );
}
