// ============================================
// CHAT MODAL COMPONENT
// A popup chat window for messaging between two users.
// Opens when you click "Message" on a ProfileModal or UserCard.
// ============================================

import { useState, useEffect, useRef, useCallback } from "react";
import { sendMessage, getMessages } from "../api";
import "./ChatModal.css";

// ---- COMPONENT ----
// Props:
//   currentUser = the logged-in user (who is sending messages)
//   chatUser = the user being messaged (who is receiving messages)
//   onClose = function to close the chat modal
export default function ChatModal({ currentUser, chatUser, onClose }) {
  // State for the list of messages in the conversation
  const [messages, setMessages] = useState([]);

  // State for the text currently being typed in the input
  const [inputText, setInputText] = useState("");

  // State for showing a sending indicator
  const [sending, setSending] = useState(false);

  // useRef creates a reference to a DOM element
  // We use it to auto-scroll to the bottom of the chat when new messages arrive
  const messagesEndRef = useRef(null);

  // Fetch conversation history from the C++ backend
  const loadMessages = useCallback(async () => {
    try {
      const data = await getMessages(currentUser.userName, chatUser.userName);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, [currentUser.userName, chatUser.userName]);

  // Load messages when the modal opens
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send a new message
  const handleSend = async (e) => {
    e.preventDefault(); // prevent page refresh from form submit

    // Don't send empty messages
    const trimmed = inputText.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      await sendMessage(currentUser.userName, chatUser.userName, trimmed);
      setInputText(""); // clear the input after sending
      await loadMessages(); // reload messages to show the new one
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  // Close on Escape key
  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="chat-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      id="chat-modal-overlay"
    >
      <div
        className="chat-modal animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        id="chat-modal"
      >
        {/* Chat Header */}
        <div className="chat-header">
          <div className="chat-header-user">
            <div className="chat-avatar">
              {chatUser.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h3 className="chat-user-name">{chatUser.name}</h3>
              <p className="chat-user-handle">@{chatUser.userName}</p>
            </div>
          </div>
          <button className="chat-close" onClick={onClose} id="chat-close-btn">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="chat-messages" id="chat-messages">
          {messages.length === 0 ?
            <div className="chat-empty">
              <p>No messages yet.</p>
              <p className="chat-empty-hint">
                Say hi to {chatUser.name?.split(" ")[0]}! 👋
              </p>
            </div>
          : messages.map((msg, i) => (
              <div
                key={i}
                // "sent" class = right-aligned (your messages)
                // "received" class = left-aligned (their messages)
                className={`chat-bubble ${msg.from === currentUser.userName ? "sent" : "received"}`}
              >
                <p className="chat-bubble-text">{msg.text}</p>
                <span className="chat-bubble-time">{msg.timestamp}</span>
              </div>
            ))
          }
          {/* Invisible div at the bottom — scrollIntoView targets this */}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form
          className="chat-input-area"
          onSubmit={handleSend}
          id="chat-input-form"
        >
          <input
            type="text"
            className="chat-input"
            id="chat-input"
            placeholder={`Message ${chatUser.name?.split(" ")[0]}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="chat-send-btn"
            id="chat-send-btn"
            disabled={sending || !inputText.trim()}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
