import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { UploadCloud, FileText, Sparkles, AlertCircle, Download, FileEdit, Bold, Italic, List, Type, Palette, Menu, X, Clock, ChevronRight, LogIn, LogOut } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

const SimpleEditor = ({ initialValue, onChange }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML === '') {
      editorRef.current.innerHTML = initialValue.replace(/\n/g, '<br/>');
      onChange(editorRef.current.innerHTML);
    }
  }, [initialValue]);

  const exec = (command, value = null) => {
    if (editorRef.current) {
      editorRef.current.focus(); // Force browser focus into the editor
      document.execCommand('styleWithCSS', false, true); // Tell the browser to use modern CSS (spans) instead of ancient <font> tags.
      document.execCommand(command, false, value);
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="custom-editor-wrapper">
      <div className="editor-toolbar">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} title="Bold"><Bold size={16}/></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} title="Italic"><Italic size={16}/></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} title="Bullet List"><List size={16}/></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'H3'); }} title="Header Text"><Type size={16}/></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('hiliteColor', 'yellow'); }} title="Highlight"><Palette size={16}/></button>
      </div>
      <div 
        ref={editorRef}
        contentEditable
        className="custom-editor-content"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  );
};
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [notes, setNotes] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [resumeHistory, setResumeHistory] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
      setError(`Auth Error: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistoryItem = (item) => {
    setAiFeedback(item.aiFeedback);
    setResumeText(item.resumeText);
    setTargetRole(item.targetRole);
    if(window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const startNew = () => {
    setAiFeedback(null); 
    setResumeText(""); 
    setFile(null);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError("Please upload a PDF or DOCX file.");
      return;
    }

    if (!user) {
      setError("Please sign in with Google to use the AI features.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_role", targetRole);
    formData.append("notes", notes);

    setLoading(true);
    setError(null);
    setAiFeedback(null);
    setResumeText("");

    try {
      const idToken = await user.getIdToken();
      const rawApiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const API_URL = rawApiUrl.replace(/\/$/, ""); 
      
      console.log(`Sending request to: ${API_URL}/api/review`);

      const response = await axios.post(`${API_URL}/api/review`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${idToken}`
        }
      });
      setAiFeedback(response.data.ai_feedback);
      setResumeText(response.data.extracted_text);

      
      const newEntry = {
        id: Date.now(),
        targetRole,
        fileName: file.name,
        resumeText: response.data.extracted_text,
        aiFeedback: response.data.ai_feedback,
        timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };
      setResumeHistory(prev => [newEntry, ...prev]);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "An error occurred while processing the resume. Make sure the backend server is running.");
      if (err.response?.data?.detail?.includes("404")) {
          setError("AI Model issue detected. Make sure you are using gemini-2.5-flash in the backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadResume = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + resumeText + footer;
    
    const element = document.createElement("a");
    const file = new Blob(['\ufeff', sourceHTML], {type: 'application/msword'});
    element.href = URL.createObjectURL(file);
    element.download = "Edited_Resume.doc";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="layout-wrapper">
      {/* Sidebar Overlay */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>

      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2><Clock size={20}/> History</h2>
          <button className="icon-btn" onClick={() => setIsSidebarOpen(false)}><X size={20}/></button>
        </div>
        <div className="sidebar-content">
          {resumeHistory.length === 0 ? (
            <div className="empty-history">
              <p>No resumes uploaded yet.</p>
            </div>
          ) : (
            resumeHistory.map(item => (
              <div key={item.id} className="history-item" onClick={() => loadHistoryItem(item)}>
                <div className="history-role">{item.targetRole}</div>
                <div className="history-file"><FileText size={14}/> {item.fileName}</div>
                <div className="history-time">{item.timestamp} <ChevronRight size={14} className="history-chevron"/></div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="main-content">
        <div className="top-nav">
          <button className="menu-btn" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24}/>
          </button>
          
          <div className="auth-container">
            {user ? (
              <div className="user-profile">
                {user.photoURL && <img src={user.photoURL} alt="Profile" className="user-avatar" />}
                <button className="icon-btn auth-out-btn" onClick={handleSignOut} title="Sign Out">
                  <LogOut size={20}/>
                </button>
              </div>
            ) : (
              <button className="btn-secondary sign-in-btn" onClick={handleGoogleSignIn}>
                <LogIn size={18}/> Sign in with Google
              </button>
            )}
          </div>
        </div>

        <div className="app-container">
          <div className="header">
            <h1>lazyresume.ai ⚡</h1>
            <p>Lazy for You, Smart for Your Resume.</p>
            <div className="title-divider"></div>
          </div>

          {!aiFeedback && (
        <div className="glass-card">
          {error && (
            <div className="error-banner">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div 
              className={`upload-zone ${file ? 'active' : ''}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload').click()}
            >
              <input 
                id="file-upload" 
                type="file" 
                accept=".pdf,.docx" 
                style={{ display: 'none' }} 
                onChange={handleFileChange}
              />
              
              {file ? (
                <>
                  <FileText className="upload-icon" />
                  <div className="upload-text">{file.name}</div>
                  <div className="upload-subtext">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </>
              ) : (
                <>
                  <UploadCloud className="upload-icon" />
                  <div className="upload-text">Click or Drag & Drop to Upload</div>
                  <div className="upload-subtext">Supports PDF and DOCX only</div>
                </>
              )}
            </div>

            <div className="form-grid">
              <div className="input-group">
                <label className="input-label">Target Role / Industry</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Senior Frontend Developer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Focus Areas / Notes (Optional)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Highlight my leadership experience"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading || !file}>
              {loading ? 'AI is Analyzing...' : 'Enhance My Resume'}
              {loading ? <span /> : <Sparkles size={20} />}
            </button>
          </form>
        </div>
      )}

      {loading && (
         <div className="loader-container">
           <div className="spinner"></div>
           <p className="loader-text">Extracting text and running neural analysis...</p>
         </div>
      )}

      {aiFeedback && !loading && (
        <div className="dashboard">
          <button 
            className="btn-secondary back-btn" 
            onClick={startNew}
          >
            ← Upload Another Resume
          </button>
          
          <div className="split-view">
            {/* Editor Pane */}
            <div className="glass-card editor-pane">
              <div className="pane-header">
                <h2><FileEdit size={24} /> Editor</h2>
                <button className="btn-success" onClick={downloadResume}>
                  <Download size={18} /> Download (.doc)
                </button>
              </div>
              <p className="pane-subtitle">Edit and format your resume text below.</p>
              <SimpleEditor 
                initialValue={resumeText} 
                onChange={(val) => setResumeText(val)} 
              />
            </div>

            {/* AI Feedback Pane */}
            <div className="glass-card feedback-pane">
              <div className="pane-header">
                <h2 className="gradient-text"><Sparkles size={24} /> AI Suggestions</h2>
              </div>
              <p className="pane-subtitle">Copy the improvements and paste them into your editor.</p>
              <div className="markdown-body">
                <ReactMarkdown>{aiFeedback}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

export default App;
