import React, { useState, useEffect, useRef } from 'react';
import { Folder, FileText, Upload, Trash2, Eye, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAuth } from '../api';

const CATEGORIES = [
  "CV", "10th Grade", "12th Grade", "Semester 1", "Semester 2", 
  "Semester 3", "Semester 4", "Semester 5", "Semester 6", 
  "Semester 7", "Semester 8", "Personal"
];

export default function DocumentsView({ onUpdate }) {
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploadCategory, setUploadCategory] = useState("CV");
  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetchAuth(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/documents`);
      const data = await res.json();
      setDocuments(data.documents || {});
      
      // Auto-select first available category
      const available = CATEGORIES.find(cat => !data.documents?.[cat] || data.documents[cat].length === 0);
      if (available) setUploadCategory(available);
      
    } catch (e) {
      console.error('Failed to fetch documents', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!uploadCategory) {
      alert("Please select a category first.");
      return;
    }
    
    const formData = new FormData();
    formData.append('category', uploadCategory);
    formData.append('file', files[0]);

    try {
      await fetchAuth(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/vault/upload`, {
        method: 'POST',
        body: formData
      });
      await fetchDocuments();
      if (onUpdate) onUpdate(); // Trigger App.jsx refetch
    } catch (e) {
      console.error('Upload failed', e);
    }
  };

  const handleDelete = async (category, filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      await fetchAuth(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/documents/${category}/${filename}`, {
        method: 'DELETE'
      });
      await fetchDocuments();
      if (onUpdate) onUpdate(); // Trigger App.jsx refetch
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const getPreviewUrl = (category, filename) => {
    const token = localStorage.getItem('mentor_token');
    return `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/documents/${category}/${filename}?token=${token}`;
  };

  const isPreviewable = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'txt', 'json', 'md'].includes(ext);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col h-full relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-medium text-[#e0d8cd]">Document Management</h2>
          <p className="text-sm text-[#8a7b6b] mt-1">Upload CVs, Marksheets, and reference materials</p>
        </div>
        <div className="flex items-center space-x-4">
          <select 
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="bg-[#161311] border border-[#2a2522] rounded-lg px-4 py-2 text-sm text-[#e0d8cd] focus:outline-none focus:border-[#cba36b]"
          >
            {CATEGORIES.map(cat => {
              const hasFile = documents[cat] && documents[cat].length > 0;
              const isLockedCategory = ["10th Grade", "12th Grade"].includes(cat) || cat.startsWith("Semester");
              const isDisabled = isLockedCategory && hasFile;
              
              // Only hide the option if it's disabled, as requested ("dont add it in the dropdown")
              if (isDisabled) return null;
              
              return (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              );
            })}
          </select>

          <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 bg-[#cba36b] text-[#0d0c0b] px-4 py-2 rounded-lg font-semibold hover:bg-[#d9ba88] transition-colors"
          >
            <Upload size={16} />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#cba36b] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map(category => {
            const files = documents[category] || [];
            if (files.length === 0 && !["CV"].includes(category)) return null;
            
            return (
            <div key={category} className="bg-[#161311] border border-[#2a2522] rounded-xl overflow-hidden">
              <div className="bg-[#1e1916] px-6 py-4 flex items-center space-x-3 border-b border-[#2a2522]">
                <Folder size={18} className="text-[#cba36b]" />
                <h3 className="font-medium text-[#e0d8cd]">{category}</h3>
                <span className="text-xs text-[#8a7b6b] bg-[#2a2522] px-2 py-0.5 rounded-full">{files.length}</span>
              </div>
              
              <div className="divide-y divide-[#2a2522]">
                {files.filter(f => !f.startsWith('thumbnail_')).map(filename => {
                  const isPdfNote = category === 'Notes' && filename.toLowerCase().endsWith('.pdf');
                  const thumbnailName = `thumbnail_${filename}.png`;
                  const hasThumbnail = isPdfNote && files.includes(thumbnailName);
                  
                  return (
                  <div key={filename} className="px-6 py-4 flex items-center justify-between hover:bg-[#1a1715] transition-colors">
                    <div className="flex items-center space-x-4">
                      {hasThumbnail ? (
                        <div className="w-12 h-12 rounded-lg bg-[#2a2522] overflow-hidden shrink-0 border border-[#2a2522]">
                          <img src={getPreviewUrl(category, thumbnailName)} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#2a2522] flex items-center justify-center shrink-0">
                          <FileText size={20} className="text-[#8a7b6b]" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-[#e0d8cd] truncate max-w-md">{filename}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {isPreviewable(filename) && (
                        <a 
                          href={getPreviewUrl(category, filename)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 text-[#8a7b6b] hover:text-[#cba36b] hover:bg-[#2a2522] rounded-lg transition-colors"
                        >
                          <Eye size={16} />
                        </a>
                      )}
                      <a 
                        href={getPreviewUrl(category, filename)} 
                        download
                        className="p-2 text-[#8a7b6b] hover:text-[#e0d8cd] hover:bg-[#2a2522] rounded-lg transition-colors"
                      >
                        <Download size={16} />
                      </a>
                      <button 
                        onClick={() => handleDelete(category, filename)}
                        className="p-2 text-[#8a7b6b] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  );
                })}
                {files.length === 0 && (
                  <div className="px-6 py-8 flex flex-col items-center justify-center text-[#8a7b6b]">
                    <Folder size={32} className="opacity-20 mb-2" />
                    <p className="text-sm">No files uploaded yet.</p>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
