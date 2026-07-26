import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Folder, FileText, Upload, Trash2, Eye, Download, Search, RefreshCw, X, CheckCircle, Clock } from 'lucide-react';
import { fetchAuth } from '../api';

export default function NotesView({ onUpdate }) {
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [toast, setToast] = useState('');
  const [indexStatus, setIndexStatus] = useState({ uploaded: 0, indexed: 0, ready: false });
  const [pollingStatus, setPollingStatus] = useState(false);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetchAuth('http://localhost:8000/api/documents');
      const data = await res.json();
      setDocuments(data.documents || {});
    } catch (e) {
      console.error('Failed to fetch documents', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchIndexStatus = useCallback(async () => {
    try {
      const res = await fetchAuth('http://localhost:8000/api/notes/status');
      const data = await res.json();
      setIndexStatus(data);
      return data;
    } catch (e) {
      return null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setPollingStatus(true);
    pollRef.current = setInterval(async () => {
      const status = await fetchIndexStatus();
      if (status?.ready) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setPollingStatus(false);
        setReindexing(false);
        if (status.indexed > 0) {
          showToast('✅ Notes indexed and ready to search!');
        } else {
          showToast('⚠️ Done — your PDF appears to be scanned/image-based (no extractable text). Try uploading a text-based PDF or .txt file.');
        }
      }
    }, 3000);
  }, [fetchIndexStatus]);

  useEffect(() => {
    fetchDocuments();
    fetchIndexStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const formData = new FormData();
    formData.append('category', 'Notes');
    formData.append('file', files[0]);

    try {
      showToast('Uploading and indexing…');
      await fetchAuth('http://localhost:8000/api/vault/upload', {
        method: 'POST',
        body: formData
      });
      await fetchDocuments();
      // Poll until this new note is indexed
      startPolling();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error('Upload failed', e);
      showToast('Upload failed.');
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      await fetchAuth(`http://localhost:8000/api/documents/Notes/${filename}`, {
        method: 'DELETE'
      });
      await fetchDocuments();
      await fetchIndexStatus();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearching(true);
      const res = await fetchAuth('http://localhost:8000/api/notes/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleReindex = async () => {
    try {
      setReindexing(true);
      await fetchAuth('http://localhost:8000/api/notes/reindex', { method: 'POST' });
      showToast('Re-indexing started… search will unlock once all notes are ready.');
      startPolling();
    } catch (e) {
      console.error('Reindex failed', e);
      setReindexing(false);
    }
  };

  const getPreviewUrl = (filename) => {
    const token = localStorage.getItem('mentor_token');
    return `http://localhost:8000/api/documents/Notes/${filename}?token=${token}`;
  };

  const isPreviewable = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'txt', 'json', 'md'].includes(ext);
  };

  const notesFiles = documents['Notes'] || [];
  const visibleFiles = notesFiles.filter(f => !f.startsWith('thumbnail_'));
  const searchReady = indexStatus.ready;
  const hasUploaded = indexStatus.uploaded > 0;

  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col h-full relative text-[#e0d8cd]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-[#1e1916] border border-[#cba36b]/40 text-[#e0d8cd] px-5 py-3 rounded-xl text-sm font-medium shadow-xl flex items-center space-x-2">
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-medium text-[#e0d8cd]">Study Notes</h2>
          <p className="text-sm text-[#8a7b6b] mt-1">Upload, manage and semantically search your academic materials</p>
        </div>
        <div className="flex items-center space-x-3">
          {hasUploaded && !searchReady && (
            <button
              onClick={handleReindex}
              disabled={reindexing || pollingStatus}
              title="Index all notes for semantic search"
              className="flex items-center space-x-2 bg-[#1e1916] border border-[#cba36b]/40 text-[#cba36b] px-3 py-2 rounded-lg text-sm hover:bg-[#cba36b]/10 transition-colors disabled:opacity-60"
            >
              <RefreshCw size={14} className={(reindexing || pollingStatus) ? 'animate-spin' : ''} />
              <span>{(reindexing || pollingStatus) ? 'Indexing…' : 'Index Notes'}</span>
            </button>
          )}
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} accept=".pdf,.txt,.md" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 bg-[#cba36b] text-[#0d0c0b] px-4 py-2 rounded-lg font-semibold hover:bg-[#d9ba88] transition-colors"
          >
            <Upload size={16} />
            <span>Upload Note</span>
          </button>
        </div>
      </div>

      {/* Semantic Search */}
      <div className="bg-[#161311] border border-[#2a2522] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-[#8a7b6b] font-semibold uppercase tracking-wider">Semantic Search</p>
          {/* Status badge */}
          {hasUploaded ? (
            searchReady ? (
              <span className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                <CheckCircle size={11} />
                <span>{indexStatus.indexed}/{indexStatus.uploaded} notes indexed</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 text-xs text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">
                <Clock size={11} className={(reindexing || pollingStatus) ? 'animate-pulse' : ''} />
                <span>
                  {(reindexing || pollingStatus)
                    ? `Indexing… ${indexStatus.indexed}/${indexStatus.uploaded}`
                    : `${indexStatus.indexed}/${indexStatus.uploaded} indexed — click "Index Notes"`}
                </span>
              </span>
            )
          ) : (
            <span className="text-xs text-[#5a4b3b]">No notes uploaded yet</span>
          )}
        </div>

        {searchReady ? (
          <>
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7b6b]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Ask anything across your notes, e.g. 'what is binary search?'"
                  className="w-full bg-[#0d0c0b] border border-[#2a2522] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[#e0d8cd] placeholder-[#5a4b3b] focus:outline-none focus:border-[#cba36b]/60"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7b6b] hover:text-[#e0d8cd]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="flex items-center space-x-2 bg-[#cba36b]/10 border border-[#cba36b]/30 text-[#cba36b] px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#cba36b]/20 transition-colors disabled:opacity-40"
              >
                {isSearching
                  ? <div className="w-4 h-4 border-2 border-[#cba36b] border-t-transparent rounded-full animate-spin" />
                  : <Search size={14} />}
                <span>{isSearching ? 'Searching…' : 'Search'}</span>
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1" style={{scrollbarWidth: 'thin', scrollbarColor: '#2a2522 transparent'}}>
                {searchResults.map((res, i) => (
                  <div key={i} className="bg-[#0d0c0b] border border-[#2a2522] rounded-lg p-4 hover:border-[#cba36b]/30 transition-all">
                    <p className="text-xs text-[#cba36b] mb-1.5 font-semibold flex items-center space-x-1">
                      <FileText size={11} />
                      <span>{res.filename}</span>
                    </p>
                    <p className="text-sm text-[#c0b8a8] leading-relaxed">{res.text}</p>
                  </div>
                ))}
              </div>
            )}
            {searchQuery && !isSearching && searchResults.length === 0 && (
              <p className="mt-3 text-sm text-[#8a7b6b] italic">No matches found for "{searchQuery}".</p>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            {!hasUploaded ? (
              <p className="text-sm text-[#5a4b3b]">Upload a note above to enable semantic search.</p>
            ) : (reindexing || pollingStatus) ? (
              <div className="flex flex-col items-center space-y-3">
                <div className="w-6 h-6 border-2 border-[#cba36b] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#8a7b6b]">Indexing your notes… search will unlock automatically.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-3">
                <p className="text-sm text-[#8a7b6b]">Your notes aren't indexed yet. Click <strong className="text-[#cba36b]">Index Notes</strong> above to enable search.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notes List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#cba36b] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-[#161311] border border-[#2a2522] rounded-xl overflow-hidden">
          <div className="bg-[#1e1916] px-6 py-4 flex items-center space-x-3 border-b border-[#2a2522]">
            <Folder size={18} className="text-[#cba36b]" />
            <h3 className="font-medium text-[#e0d8cd]">Notes</h3>
            <span className="text-xs text-[#8a7b6b] bg-[#2a2522] px-2 py-0.5 rounded-full">{visibleFiles.length}</span>
          </div>
          
          <div className="divide-y divide-[#2a2522]">
            {visibleFiles.map(filename => {
              const isPdfNote = filename.toLowerCase().endsWith('.pdf');
              const thumbnailName = `thumbnail_${filename}.png`;
              const hasThumbnail = isPdfNote && notesFiles.includes(thumbnailName);
              
              return (
                <div key={filename} className="px-6 py-4 flex items-center justify-between hover:bg-[#1a1715] transition-colors">
                  <div className="flex items-center space-x-4">
                    {hasThumbnail ? (
                      <div className="w-12 h-12 rounded-lg bg-[#2a2522] overflow-hidden shrink-0 border border-[#2a2522]">
                        <img src={getPreviewUrl(thumbnailName)} alt="preview" className="w-full h-full object-cover" />
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
                        href={getPreviewUrl(filename)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-[#8a7b6b] hover:text-[#cba36b] hover:bg-[#2a2522] rounded-lg transition-colors"
                      >
                        <Eye size={16} />
                      </a>
                    )}
                    <a
                      href={getPreviewUrl(filename)}
                      download
                      className="p-2 text-[#8a7b6b] hover:text-[#e0d8cd] hover:bg-[#2a2522] rounded-lg transition-colors"
                    >
                      <Download size={16} />
                    </a>
                    <button
                      onClick={() => handleDelete(filename)}
                      className="p-2 text-[#8a7b6b] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            
            {visibleFiles.length === 0 && (
              <div className="px-6 py-12 flex flex-col items-center justify-center text-[#8a7b6b]">
                <Folder size={36} className="opacity-20 mb-3" />
                <p className="text-sm">No notes uploaded yet.</p>
                <p className="text-xs mt-1 opacity-60">Upload a PDF or text file to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
