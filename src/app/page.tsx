"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowDown, ArrowUp, BookOpen, Check, ChevronDown, FileText, ImagePlus, Lightbulb,
  Menu, MessageCircle, MoreHorizontal, Paperclip, Plus, Search, Sparkles, Trash2, X,
} from "lucide-react";
import {
  deleteConversation, loadConversations, loadFile, saveConversations, saveFile,
  type Attachment, type Conversation, type Message,
} from "@/lib/storage";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.json";
const starters = [
  { icon: Lightbulb, label: "Explain a tricky idea", prompt: "Can you explain a tricky idea in simple terms?" },
  { icon: ImagePlus, label: "Explore an image", prompt: "Help me understand what is in this picture." },
  { icon: BookOpen, label: "Make a quick quiz", prompt: "Create a short quiz to help me practice this topic." },
];

function createConversation(): Conversation {
  return { id: crypto.randomUUID(), title: "New study session", topic: "", updatedAt: Date.now(), messages: [], attachments: [] };
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [topicDraft, setTopicDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<{ file: File; attachment: Attachment } | null>(null);
  const [loadingChatId, setLoadingChatId] = useState("");
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuId, setMenuId] = useState("");
  const [topicOpen, setTopicOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const endOfMessages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((response) => response.json() as Promise<{ configured?: boolean }>)
      .then((result) => setApiConfigured(Boolean(result.configured)))
      .catch(() => setApiConfigured(false));
  }, []);

  useEffect(() => {
    loadConversations().then((saved) => {
      if (saved.length) {
        setConversations(saved);
        setActiveId(saved[0].id);
      } else {
        const first = createConversation();
        setConversations([first]);
        setActiveId(first.id);
      }
      setReady(true);
    }).catch(() => {
      const first = createConversation();
      setConversations([first]);
      setActiveId(first.id);
      setReady(true);
      setNotice("Browser storage is unavailable. This session may not be saved.");
    });
  }, []);

  useEffect(() => {
    if (ready) void saveConversations(conversations).catch(() => setNotice("Could not save this session in your browser."));
  }, [conversations, ready]);

  const active = conversations.find((conversation) => conversation.id === activeId);
  const activeTopic = active?.topic;
  const visibleConversations = conversations.filter((conversation) => conversation.title.toLowerCase().includes(query.toLowerCase()));
  const isLoading = loadingChatId === activeId;

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length, isLoading]);

  useEffect(() => {
    setTopicDraft(activeTopic ?? "");
  }, [activeTopic]);

  function updateConversation(id: string, update: (conversation: Conversation) => Conversation) {
    setConversations((current) => current.map((conversation) => conversation.id === id ? update(conversation) : conversation).sort((a, b) => b.updatedAt - a.updatedAt));
  }

  function startNewChat() {
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setDraft("");
    setPendingFile(null);
    setNotice("");
    setSidebarOpen(false);
    composer.current?.focus();
  }

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setNotice("Files must be 3 MB or smaller.");
      return;
    }
    if (!file.type.startsWith("image/") && !["application/pdf", "text/plain", "text/markdown", "text/csv", "application/json"].includes(file.type)) {
      setNotice("Choose a PDF, image, text, Markdown, CSV, or JSON file.");
      return;
    }
    const id = crypto.randomUUID();
    const attachment = { id, name: file.name, type: file.type || "application/octet-stream", size: file.size };
    try {
      await saveFile(id, file);
      setPendingFile({ file, attachment });
      setNotice("");
    } catch {
      setNotice("Could not save that file in this browser. Try a smaller file or another browser.");
    }
  }

  async function submitMessage(event?: FormEvent, override?: string) {
    event?.preventDefault();
    if (!active || isLoading) return;
    const content = (override ?? draft).trim();
    if (!content && !pendingFile) return;
    const now = Date.now();
    const userMessage: Message = {
      id: crypto.randomUUID(), role: "user", content: content || "What is in this file?", createdAt: now,
      ...(pendingFile ? { attachment: pendingFile.attachment } : {}),
    };
    const attachment = pendingFile?.attachment ?? active.attachments.at(-1);
    const updatedMessages = [...active.messages, userMessage];
    const updatedAttachments = pendingFile ? [...active.attachments, pendingFile.attachment] : active.attachments;
    const title = active.messages.length === 0 ? (userMessage.content.slice(0, 38) || pendingFile?.attachment.name || "New study session") : active.title;
    const updated: Conversation = { ...active, title, messages: updatedMessages, attachments: updatedAttachments, updatedAt: now };
    updateConversation(active.id, () => updated);
    setDraft("");
    setPendingFile(null);
    setNotice("");
    setLoadingChatId(active.id);

    try {
      const history = updatedMessages.slice(-12).map((message) => ({ role: message.role === "assistant" ? "model" : "user", content: message.content }));
      const lastAttachment = attachment ? await loadFile(attachment.id) : undefined;
      const filePayload = lastAttachment && attachment ? { name: attachment.name, type: attachment.type, data: await toBase64(lastAttachment) } : undefined;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, topic: active.topic, attachment: filePayload }),
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "The tutor could not answer just now.");
      const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: result.answer || "I couldn't form an answer. Try asking another way.", createdAt: Date.now() };
      updateConversation(active.id, (conversation) => ({ ...conversation, messages: [...conversation.messages, assistantMessage], updatedAt: Date.now() }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setLoadingChatId("");
    }
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  function saveTopic() {
    if (!active) return;
    updateConversation(active.id, (conversation) => ({ ...conversation, topic: topicDraft.trim() }));
    setTopicOpen(false);
  }

  async function removeConversation(conversation: Conversation) {
    await deleteConversation(conversation).catch(() => undefined);
    const remaining = conversations.filter((item) => item.id !== conversation.id);
    if (!remaining.length) {
      const next = createConversation();
      setConversations([next]);
      setActiveId(next.id);
    } else {
      setConversations(remaining);
      if (activeId === conversation.id) setActiveId(remaining[0].id);
    }
    setMenuId("");
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><BookOpen size={18} strokeWidth={2.2} /></div><span>study buddy</span><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
        <button className="new-chat-button" onClick={startNewChat}><Plus size={17} /> New study session <span className="shortcut">N</span></button>
        <div className="sidebar-section-heading"><span>YOUR SPACE</span></div>
        <button className="nav-item nav-selected"><MessageCircle size={16} /><span>Study room</span><span className="nav-dot" /></button>
        <div className="history-heading"><span>RECENT SESSIONS</span><span>{conversations.length.toString().padStart(2, "0")}</span></div>
        <label className="history-search"><Search size={15} /><input placeholder="Find a session" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search study history" />{query && <button className="icon-button search-clear" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label>
        <div className="history-list">
          {visibleConversations.map((conversation) => (
            <div className={`history-row ${activeId === conversation.id ? "history-active" : ""}`} key={conversation.id}>
              <button className="history-link" onClick={() => { setActiveId(conversation.id); setPendingFile(null); setNotice(""); setSidebarOpen(false); }}>
                <span className="history-icon"><MessageCircle size={15} /></span><span className="history-title">{conversation.title}</span>
              </button>
              <button className="icon-button history-menu-trigger" aria-label={`More options for ${conversation.title}`} onClick={() => setMenuId(menuId === conversation.id ? "" : conversation.id)}><MoreHorizontal size={17} /></button>
              {menuId === conversation.id && <button className="history-delete" onClick={() => void removeConversation(conversation)}><Trash2 size={14} /> Delete session</button>}
            </div>
          ))}
          {visibleConversations.length === 0 && <p className="empty-search">No matching sessions</p>}
        </div>
        <div className="sidebar-bottom"><div className="profile-avatar">S</div><div className="profile-copy"><strong>Curious mind</strong><span>Your learning space</span></div><Sparkles size={16} className="profile-spark" /></div>
      </aside>
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><span>MY LEARNING</span><span className="crumb-slash">/</span><strong>Study room</strong></div>
          <div className="topbar-right"><span className={`online-dot ${apiConfigured === false ? "offline-dot" : ""}`} /> {apiConfigured === null ? "Connecting to tutor" : apiConfigured ? "AI tutor ready" : "API key needed"} <span className="topbar-divider" /><span className="topbar-date">A little curiosity goes a long way</span></div>
        </header>

        <div className="learning-layout">
          <section className="chat-column">
            <div className="welcome-row">
              <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR PERSONAL LEARNING SPACE</div><h1>Make room for <em>curiosity.</em></h1><p className="welcome-subtitle">Big questions, little questions, and everything in between.</p></div>
              <div className="today-stamp"><span>LEARN AT</span><strong>your pace</strong><span>ONE QUESTION AT A TIME</span></div>
            </div>

            <div className="topic-strip">
              <div className="topic-label"><span className="topic-icon"><BookOpen size={15} /></span><span><b>STUDYING</b><small>Keep your session focused</small></span></div>
              <div className="topic-value">{active?.topic || "Choose a topic"}</div>
              <button className="topic-edit" onClick={() => setTopicOpen(!topicOpen)}>{active?.topic ? "Edit topic" : "Add topic"}<ChevronDown size={14} /></button>
              {topicOpen && <form className="topic-popover" onSubmit={(event) => { event.preventDefault(); saveTopic(); }}><label htmlFor="topic-field">What are you learning?</label><input id="topic-field" value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} placeholder="e.g. The solar system" maxLength={80} autoFocus /><div><button type="button" className="topic-cancel" onClick={() => setTopicOpen(false)}>Cancel</button><button type="submit" className="topic-save"><Check size={14} /> Save topic</button></div></form>}
            </div>

            <div className={`conversation ${active?.messages.length ? "conversation-filled" : ""}`}>
              {!active?.messages.length ? (
                <div className="empty-state">
                  <div className="welcome-illustration"><div className="illustration-sun" /><div className="illustration-paper"><span /><span /><span /></div><span className="illustration-spark spark-one">✳</span><span className="illustration-spark spark-two">✦</span></div>
                  <div className="empty-kicker"><span /> A GOOD PLACE TO BEGIN</div><h2>What would you like<br />to understand <em>today?</em></h2><p>Ask anything, share a page from your notes, or show me something you found.</p>
                  <div className="starter-list">{starters.map(({ icon: Icon, label, prompt }) => <button className="starter-chip" key={label} onClick={() => { setDraft(prompt); composer.current?.focus(); }}><Icon size={16} /><span>{label}</span><ArrowUp size={14} className="starter-arrow" /></button>)}</div>
                  <div className="privacy-note"><span className="privacy-lock">✳</span> Your conversations stay in this browser</div>
                </div>
              ) : (
                <div className="message-list">
                  <div className="session-date"><span /> SESSION NOTES <span /> <small>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(active.updatedAt)}</small></div>
                  {active.messages.map((message) => (
                    <article className={`message message-${message.role}`} key={message.id}>
                      <div className={`message-avatar ${message.role === "assistant" ? "tutor-avatar" : "user-avatar"}`}>{message.role === "assistant" ? <Sparkles size={15} /> : "S"}</div>
                      <div className="message-body"><div className="message-meta"><strong>{message.role === "assistant" ? "Study Buddy" : "You"}</strong><time>{formatTime(message.createdAt)}</time></div>
                        {message.attachment && <div className="message-attachment"><FileText size={15} /><span>{message.attachment.name}</span><small>{formatFileSize(message.attachment.size)}</small></div>}
                        {message.content && <div className="message-copy">{message.content.split("\n").map((line, index) => line ? <p key={`${message.id}-${index}`}>{line}</p> : <br key={`${message.id}-${index}`} />)}</div>}
                      </div>
                    </article>
                  ))}
                  {isLoading && <div className="message message-assistant"><div className="message-avatar tutor-avatar"><Sparkles size={15} /></div><div className="message-body"><div className="message-meta"><strong>Study Buddy</strong><span className="thinking-label">thinking it through</span></div><div className="thinking-dots"><span /><span /><span /></div></div></div>}
                  <div ref={endOfMessages} />
                </div>
              )}
            </div>

            {notice && <div className="notice" role="alert"><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={15} /></button></div>}

            <form className="composer-wrap" onSubmit={(event) => void submitMessage(event)}>
              {pendingFile && <div className="pending-file"><span className="pending-file-icon">{pendingFile.attachment.type.startsWith("image/") ? <ImagePlus size={15} /> : <FileText size={15} />}</span><span className="pending-file-name">{pendingFile.attachment.name}</span><span className="pending-file-size">{formatFileSize(pendingFile.file.size)}</span><button type="button" className="icon-button" aria-label="Remove attachment" onClick={() => setPendingFile(null)}><X size={15} /></button></div>}
              <div className="composer"><textarea ref={composer} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKey} placeholder="Ask anything you’re curious about..." rows={2} aria-label="Your question" disabled={!ready || isLoading} /><div className="composer-tools"><div className="composer-actions"><input ref={fileInput} className="visually-hidden" type="file" accept={ACCEPT} onChange={(event) => void chooseFile(event)} /><button type="button" className="tool-button" onClick={() => fileInput.current?.click()} title="Attach a file"><Paperclip size={16} /><span>Add a file</span></button><span className="tool-divider" /><button type="button" className="tool-button quiz-button" onClick={() => void submitMessage(undefined, `Create a friendly 5-question practice quiz${active?.topic ? ` about ${active.topic}` : " based on this study session"}. Ask one question at a time, wait for my answer, then tell me how I did.`)} disabled={!ready || isLoading}><Lightbulb size={15} /><span>Practice quiz</span></button></div><div className="send-hint">Shift + Enter for a new line <button type="submit" className="send-button" aria-label="Send question" disabled={!ready || isLoading || (!draft.trim() && !pendingFile)}><ArrowUp size={19} /></button></div></div></div>
              <div className="composer-footer"><span><span className="tiny-spark">✳</span> Answers are a starting point. Stay curious.</span><span>PDF, image or text <i>·</i> max 3 MB</span></div>
            </form>
          </section>

          <aside className="right-rail">
            <div className="rail-heading"><span>YOUR TOOLKIT</span><MoreHorizontal size={17} /></div>
            <section className="toolkit-block"><div className="toolkit-title"><span className="toolkit-icon coral-icon"><ImagePlus size={16} /></span><div><h3>Learn from a picture</h3><span>See it. Understand it.</span></div></div><p>Upload an image and ask about what you see, from diagrams to everyday discoveries.</p><button className="text-action" onClick={() => fileInput.current?.click()}>Choose an image <ArrowDown size={14} className="action-arrow" /></button></section>
            <div className="rail-rule" />
            <section className="toolkit-block"><div className="toolkit-title"><span className="toolkit-icon teal-icon"><FileText size={16} /></span><div><h3>Bring your notes</h3><span>Make them make sense.</span></div></div><p>Ask questions about a PDF or share text notes to get a helpful, focused explanation.</p><button className="text-action teal-action" onClick={() => fileInput.current?.click()}>Add your notes <ArrowDown size={14} className="action-arrow" /></button></section>
            <div className="rail-rule" />
            <section className="toolkit-block quiz-block"><div className="toolkit-title"><span className="toolkit-icon yellow-icon"><Lightbulb size={16} /></span><div><h3>Practice as you go</h3><span>Little checks, big progress.</span></div></div><p>Turn your current topic into a bite-sized quiz and build confidence one answer at a time.</p><button className="text-action quiz-action" onClick={() => void submitMessage(undefined, `Create a friendly 5-question practice quiz${active?.topic ? ` about ${active.topic}` : " based on this study session"}. Ask one question at a time, wait for my answer, then tell me how I did.`)} disabled={!ready || isLoading}>Start a quick quiz <ArrowDown size={14} className="action-arrow" /></button></section>
            <div className="rail-note"><div className="note-quote">“</div><p>Every expert was once a beginner who kept asking.</p><span>A NOTE FOR TODAY</span></div>
            <div className="rail-footer"><span className="rail-footer-star">✳</span><span>Made for curious minds.</span><span className="rail-footer-version">SB / 01</span></div>
          </aside>
        </div>
        <footer className="mobile-footer"><span><span className={`online-dot ${apiConfigured === false ? "offline-dot" : ""}`} /> {apiConfigured === null ? "Connecting to tutor" : apiConfigured ? "AI tutor ready" : "API key needed"}</span><span>Made for curious minds <Sparkles size={12} /></span></footer>
      </section>
    </main>
  );
}