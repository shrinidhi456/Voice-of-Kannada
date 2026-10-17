"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SCENARIOS, Scenario } from "@/data/scenarios";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  kannada?: string;
  romanization?: string;
  english?: string;
  text?: string;
  timestamp: string;
}

export default function ScenarioChatClient({ id }: { id: string }) {
  // Map "auto-rickshaw" alias to "auto" if navigated
  const scenarioId = id === "auto-rickshaw" ? "auto" : id;
  const scenario: Scenario | undefined = SCENARIOS[scenarioId];

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!scenario) return [];
    return [
      {
        id: "msg-initial",
        sender: "ai",
        kannada: scenario.firstMessage.kannada,
        romanization: scenario.firstMessage.romanization,
        english: scenario.firstMessage.english,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });

  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [hasKannadaVoice, setHasKannadaVoice] = useState<boolean | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, transcript]);

  // Check Kannada voice availability in browser speechSynthesis
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const checkVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const found = voices.some(
            (v) =>
              v.lang.toLowerCase() === "kn-in" ||
              v.lang.toLowerCase().startsWith("kn") ||
              v.name.toLowerCase().includes("kannada")
          );
          setHasKannadaVoice(found);
        }
      };

      checkVoice();
      window.speechSynthesis.onvoiceschanged = checkVoice;

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      };
    }
  }, []);

  // Check SpeechRecognition support on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) {
        setSpeechSupported(false);
      }
    }
  }, []);

  // Speak Kannada reply aloud using browser speechSynthesis
  const speakKannada = (kannadaText: string, msgId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const voices = window.speechSynthesis.getVoices();
      const kannadaVoice = voices.find(
        (v) =>
          v.lang.toLowerCase() === "kn-in" ||
          v.lang.toLowerCase().startsWith("kn") ||
          v.name.toLowerCase().includes("kannada")
      );

      const utterance = new SpeechSynthesisUtterance(kannadaText);
      utterance.lang = "kn-IN";
      utterance.rate = 0.9; // Slightly measured pace for language learning

      if (kannadaVoice) {
        utterance.voice = kannadaVoice;
      }

      setSpeakingMsgId(msgId);

      utterance.onend = () => {
        setSpeakingMsgId(null);
      };

      utterance.onerror = (e) => {
        if (e.error !== "canceled" && e.error !== "interrupted") {
          console.warn("Speech synthesis notice:", e.error);
        }
        setSpeakingMsgId(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
      setSpeakingMsgId(null);
    }
  };

  // Start Web Speech API SpeechRecognition
  const startListening = () => {
    if (typeof window === "undefined") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setErrorMessage(
        "Web Speech Recognition is not supported in this browser. Please use Chrome/Edge or type your response in the box below."
      );
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = "kn-IN";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
        setTranscript("");
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          interim += event.results[i][0].transcript;
        }
        setTranscript(interim);
        setInputText(interim);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          setErrorMessage(
            "Microphone access was denied. Please allow microphone permissions or type your message."
          );
        } else if (event.error === "no-speech") {
          setErrorMessage("No speech was detected. Please try again or type your message.");
        } else {
          setErrorMessage(`Mic issue (${event.error}). You can type your message below.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Speech recognition start failed:", err);
      setIsListening(false);
      setErrorMessage("Could not start microphone. Please type your message.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  };

  // Send message to Next.js /api/chat route
  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = (textOverride !== undefined ? textOverride : inputText).trim();
    if (!textToSend || isLoading) return;

    if (isListening) {
      stopListening();
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInputText("");
    setTranscript("");
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: scenario?.role,
          systemPrompt: scenario?.systemPrompt,
          history: nextHistory.map((m) => ({
            sender: m.sender,
            kannada: m.kannada,
            romanization: m.romanization,
            english: m.english,
            text: m.text,
          })),
          userMessage: textToSend,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to receive response from character.");
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        kannada: data.kannada,
        romanization: data.romanization,
        english: data.english,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Automatically speak the Kannada reply
      if (data.kannada) {
        speakKannada(data.kannada, aiMsg.id);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong while connecting to the AI.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!scenario) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-8 shadow-sm">
          <span className="text-4xl mb-4 block">🔍</span>
          <h1 className="text-2xl font-bold mb-2 text-stone-900 dark:text-white">
            Scenario Not Found
          </h1>
          <p className="text-stone-600 dark:text-stone-400 text-sm mb-6">
            We couldn&apos;t find this scenario. Please return to the home page to choose from our
            available options.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100 flex flex-col">
      {/* Header with Back button and Scenario details */}
      <header className="border-b border-stone-200/80 dark:border-stone-800/80 sticky top-0 z-40 bg-white/85 dark:bg-stone-950/85 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-colors"
            >
              <span>←</span>
              <span>Back</span>
            </Link>

            <div className="h-6 w-px bg-stone-200 dark:bg-stone-800 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{scenario.icon}</span>
              <div>
                <h1 className="text-sm sm:text-base font-bold leading-tight flex items-center gap-2">
                  <span>{scenario.title}</span>
                  <span className="text-xs font-normal text-stone-400 dark:text-stone-500">
                    ({scenario.kannadaTitle})
                  </span>
                </h1>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Role: <span className="font-medium text-amber-600 dark:text-amber-400">{scenario.characterName}</span> ({scenario.characterTitle})
                </p>
              </div>
            </div>
          </div>

          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${scenario.badgeColor} hidden md:inline-block`}>
            {scenario.tag}
          </span>
        </div>

        {/* Notice if Kannada voice is not present on the device */}
        {hasKannadaVoice === false && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-t border-b border-amber-200/60 dark:border-amber-800/60 px-4 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <div className="max-w-4xl mx-auto w-full flex items-center gap-2">
              <span>ℹ️</span>
              <span>
                <strong>Note:</strong> No Kannada voice (kn-IN) is installed in your browser/OS. Speech playback may use a system fallback voice, but full Kannada script, romanization, and English translations are provided below.
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Chat Messages List */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 overflow-y-auto space-y-5 flex flex-col justify-start">
        {messages.map((message) => {
          if (message.sender === "user") {
            return (
              <div key={message.id} className="flex justify-end items-end gap-2">
                <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-tr-xs bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 px-4 py-3 shadow-sm">
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                    {message.text}
                  </p>
                  <p className="text-[10px] text-stone-400 dark:text-stone-500 text-right mt-1.5">
                    {message.timestamp}
                  </p>
                </div>
              </div>
            );
          }

          // AI reply bubble with Kannada script, romanization, and English
          const isCurrentlySpeaking = speakingMsgId === message.id;

          return (
            <div key={message.id} className="flex items-start gap-3 max-w-[95%] sm:max-w-[85%]">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-white dark:bg-stone-800 shadow-sm border border-stone-200/60 dark:border-stone-700/60 shrink-0 mt-0.5">
                {scenario.icon}
              </div>

              <div className="flex-1 rounded-2xl rounded-tl-xs bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 p-4 sm:p-5 shadow-sm space-y-3">
                {/* Character Header */}
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-200 flex items-center gap-1.5">
                    <span>{scenario.characterName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                      AI Character
                    </span>
                  </span>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500">
                    {message.timestamp}
                  </span>
                </div>

                {/* 1. Kannada Script */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-stone-400 dark:text-stone-500 font-semibold mb-1">
                    Kannada (ಕನ್ನಡ)
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-stone-950 dark:text-stone-50 leading-relaxed font-sans">
                    {message.kannada}
                  </p>
                </div>

                {/* 2. Romanization (Pronunciation) */}
                {message.romanization && (
                  <div className="bg-amber-500/10 dark:bg-amber-500/15 rounded-xl p-3 border border-amber-500/20">
                    <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold mb-0.5">
                      How to Pronounce (Romanization)
                    </p>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200 italic leading-relaxed">
                      &ldquo;{message.romanization}&rdquo;
                    </p>
                  </div>
                )}

                {/* 3. English Translation */}
                {message.english && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-stone-400 dark:text-stone-500 font-semibold mb-0.5">
                      English Meaning
                    </p>
                    <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                      {message.english}
                    </p>
                  </div>
                )}

                {/* Replay / Speak Button */}
                <div className="pt-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => message.kannada && speakKannada(message.kannada, message.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isCurrentlySpeaking
                        ? "bg-amber-500 text-white animate-pulse"
                        : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200"
                    }`}
                    title="Listen to pronunciation"
                  >
                    <span>{isCurrentlySpeaking ? "🔊" : "🔈"}</span>
                    <span>{isCurrentlySpeaking ? "Speaking..." : "Listen / Replay"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading State / Typing indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 max-w-[85%]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-white dark:bg-stone-800 shadow-sm border border-stone-200/60 dark:border-stone-700/60 shrink-0">
              {scenario.icon}
            </div>
            <div className="rounded-2xl rounded-tl-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 px-5 py-4 shadow-sm flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                {scenario.characterName} is replying in Kannada...
              </span>
            </div>
          </div>
        )}

        {/* Error message banner */}
        {errorMessage && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/80 p-4 text-xs text-red-900 dark:text-red-200 shadow-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="text-lg shrink-0">⚠️</span>
              <div className="space-y-1">
                <p className="font-semibold text-red-950 dark:text-red-100">
                  AI Model Notice
                </p>
                <p className="leading-relaxed whitespace-pre-wrap text-stone-800 dark:text-stone-200">
                  {errorMessage}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 hover:bg-red-200 dark:bg-red-900/60 dark:hover:bg-red-900 text-red-800 dark:text-red-200 transition-colors shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input & Mic Controls Footer */}
      <footer className="border-t border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-950 p-4 sticky bottom-0 z-30">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Live Voice Recording Transcript */}
          {isListening && (
            <div className="rounded-xl bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 p-3 flex items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-300 shrink-0">
                  Listening (kn-IN):
                </span>
                <span className="text-xs text-stone-800 dark:text-stone-200 truncate font-medium">
                  {transcript || "Speak in Kannada into your mic..."}
                </span>
              </div>
              <button
                type="button"
                onClick={stopListening}
                className="text-xs font-semibold text-red-700 dark:text-red-300 hover:underline shrink-0 cursor-pointer"
              >
                Stop Mic
              </button>
            </div>
          )}

          {/* Primary Controls: Mic + Text Fallback */}
          <div className="flex items-center gap-2">
            {/* Mic Button */}
            {speechSupported ? (
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={isLoading}
                title={isListening ? "Click to stop listening" : "Click to speak in Kannada (kn-IN)"}
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all shrink-0 cursor-pointer ${
                  isListening
                    ? "bg-red-600 text-white shadow-lg shadow-red-500/30 ring-4 ring-red-500/30 animate-pulse"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                } disabled:opacity-50`}
              >
                {isListening ? "⏹" : "🎙️"}
              </button>
            ) : (
              <div
                title="Speech recognition not supported in this browser"
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-stone-200 dark:bg-stone-800 text-stone-400 shrink-0 cursor-not-allowed"
              >
                🎙️
              </div>
            )}

            {/* Fallback Text Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                placeholder={
                  isListening
                    ? "Listening to speech..."
                    : "Speak using the mic or type in Kannada / English..."
                }
                className="w-full h-12 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-4 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-60"
              />
            </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputText.trim()}
              className="h-12 px-5 rounded-xl font-semibold text-sm bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <span>Send</span>
              <span>→</span>
            </button>
          </div>

          {/* Quick Helper Tip */}
          <div className="flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500 px-1">
            <span>
              💡 Tap 🎙️ to speak Kannada, or type your message and press Enter.
            </span>
            <span>Language: Kannada (kn-IN)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
