"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  Copy,
  Terminal,
  FileCode,
  Sparkles,
  Clock,
  HardDrive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronUp,
  ChevronDown,
  Keyboard,
  Info,
  Layers,
  Code2,
  CheckCheck,
} from "lucide-react";
import { IQuestion, ITestCase } from "@/types";

interface CodingStudioProps {
  question: IQuestion;
  questionIndex: number;
  totalQuestions: number;
  code: string;
  language: string;
  onCodeChange: (code: string) => void;
  onLanguageChange: (lang: string) => void;
  onResetCode: () => void;
  onRunCode: (customInput?: string) => Promise<void>;
  onSubmitCode: () => Promise<void>;
  runningCode: boolean;
  submitting: boolean;
  runResult: any;
  userAnswered: boolean;
}

export default function CodingStudio({
  question,
  questionIndex,
  totalQuestions,
  code,
  language,
  onCodeChange,
  onLanguageChange,
  onResetCode,
  onRunCode,
  onSubmitCode,
  runningCode,
  submitting,
  runResult,
  userAnswered,
}: CodingStudioProps) {
  // Navigation & UI state
  const [leftTab, setLeftTab] = useState<"problem" | "testcases" | "help">("problem");
  const [consoleTab, setConsoleTab] = useState<"results" | "testcases" | "custom">("results");
  const [consoleExpanded, setConsoleExpanded] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(13);
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);
  const [customInput, setCustomInput] = useState<string>("");
  const [copiedInput, setCopiedInput] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const sampleCases = (question.testCases || []).filter((tc) => !tc.isHidden);

  // Synchronize scroll between line numbers gutter and code textarea
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Track cursor position
  const updateCursorPos = () => {
    if (!textareaRef.current) return;
    const textBefore = code.substring(0, textareaRef.current.selectionStart);
    const lines = textBefore.split("\n");
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  // Keyboard shortcut listener for Run (Ctrl+') and Submit (Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!runningCode && !submitting) {
          onSubmitCode();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "'" || e.key === "r")) {
        e.preventDefault();
        if (!runningCode && !submitting) {
          onRunCode(consoleTab === "custom" ? customInput : undefined);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runningCode, submitting, onRunCode, onSubmitCode, consoleTab, customInput]);

  // Code editor keyboard enhancements: Tab indentation & auto-closing brackets
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;

    // Tab key: Insert 2 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: Unindent current line
        const before = code.substring(0, start);
        const after = code.substring(end);
        const lastNewLine = before.lastIndexOf("\n");
        const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
        if (code.substring(lineStart, lineStart + 2) === "  ") {
          const newCode = code.substring(0, lineStart) + code.substring(lineStart + 2);
          onCodeChange(newCode);
          setTimeout(() => {
            target.selectionStart = Math.max(lineStart, start - 2);
            target.selectionEnd = Math.max(lineStart, end - 2);
            updateCursorPos();
          }, 0);
        }
      } else {
        const newCode = code.substring(0, start) + "  " + code.substring(end);
        onCodeChange(newCode);
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 2;
          updateCursorPos();
        }, 0);
      }
      return;
    }

    // Auto-close brackets & quotes
    const pairs: Record<string, string> = {
      "(": ")",
      "{": "}",
      "[": "]",
      '"': '"',
      "'": "'",
      "`": "`",
    };

    if (pairs[e.key] && start === end) {
      e.preventDefault();
      const close = pairs[e.key];
      const newCode = code.substring(0, start) + e.key + close + code.substring(end);
      onCodeChange(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
        updateCursorPos();
      }, 0);
      return;
    }

    // Enter key: Maintain indentation
    if (e.key === "Enter") {
      e.preventDefault();
      const before = code.substring(0, start);
      const lastNewLine = before.lastIndexOf("\n");
      const currentLine = lastNewLine === -1 ? before : before.substring(lastNewLine + 1);
      const match = currentLine.match(/^(\s+)/);
      const indent = match ? match[1] : "";
      const extraIndent = currentLine.trim().endsWith("{") || currentLine.trim().endsWith(":") ? "  " : "";
      const newCode = code.substring(0, start) + "\n" + indent + extraIndent + code.substring(end);
      onCodeChange(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1 + indent.length + extraIndent.length;
        updateCursorPos();
      }, 0);
      return;
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedInput(idx);
    setTimeout(() => setCopiedInput(null), 1500);
  };

  const lineCount = Math.max(code.split("\n").length, 18);
  const linesArray = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div
      className={`w-full flex flex-col transition-all duration-300 font-body ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-[#0d1117] p-4 text-[#e6edf3]"
          : "bg-transparent text-[#161616]"
      }`}
    >
      {/* ========================================================
          TOP CONTROL BAR (STUDIO TOOLBAR)
          ======================================================== */}
      <div
        className={`px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 mb-4 shadow-sm border ${
          isFullscreen
            ? "bg-[#161b22] border-[#30363d] text-[#e6edf3]"
            : "bg-[#f5f2eb] border-[#e6e1d8] text-[#161616]"
        }`}
      >
        {/* Left: Problem Breadcrumb & Difficulty */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#15803d]/15 border border-[#15803d]/30 text-xs font-bold text-[#15803d]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Problem #{questionIndex + 1} of {totalQuestions}</span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Easy
          </span>

          <div className="hidden sm:flex items-center gap-3 text-xs text-[#6b6966] ml-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#8c8883]" /> {question.timeLimitMs || 2000}ms
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-[#8c8883]" />{" "}
              {Math.round((question.memoryLimitKb || 262144) / 1024)}MB
            </span>
          </div>
        </div>

        {/* Right: Language Selector, Font Size, Reset, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-[#ece7df]/80 dark:bg-[#21262d] px-2.5 py-1 rounded-xl border border-[#dbdad7] dark:border-[#30363d]">
            <Code2 className="w-3.5 h-3.5 text-[#15803d]" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="text-xs font-bold bg-transparent focus:outline-none cursor-pointer text-[#161616] dark:text-[#e6edf3]"
            >
              <option value="python" className="bg-[#f5f2eb] dark:bg-[#161b22] text-[#161616] dark:text-[#e6edf3]">
                Python 3.13
              </option>
              <option value="javascript" className="bg-[#f5f2eb] dark:bg-[#161b22] text-[#161616] dark:text-[#e6edf3]">
                JavaScript (Node 24)
              </option>
              <option value="cpp" className="bg-[#f5f2eb] dark:bg-[#161b22] text-[#161616] dark:text-[#e6edf3]">
                C++ (GCC 16)
              </option>
              <option value="java" className="bg-[#f5f2eb] dark:bg-[#161b22] text-[#161616] dark:text-[#e6edf3]">
                Java (OpenJDK 23)
              </option>
            </select>
          </div>

          {/* Font Size Adjuster */}
          <div className="hidden md:flex items-center gap-1 bg-[#ece7df]/60 dark:bg-[#21262d] px-2 py-1 rounded-xl text-xs font-mono">
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.max(s - 1, 11))}
              className="px-1.5 hover:text-[#15803d]"
              title="Decrease Font Size"
            >
              A-
            </button>
            <span className="text-[10px] text-[#6b6966]">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.min(s + 1, 18))}
              className="px-1.5 hover:text-[#15803d]"
              title="Increase Font Size"
            >
              A+
            </button>
          </div>

          {/* Reset Template */}
          <button
            type="button"
            onClick={onResetCode}
            className="p-1.5 rounded-lg text-[#6b6966] hover:text-[#161616] dark:hover:text-[#e6edf3] hover:bg-[#ece7df] dark:hover:bg-[#30363d] transition"
            title="Reset code to original template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-[#6b6966] hover:text-[#161616] dark:hover:text-[#e6edf3] hover:bg-[#ece7df] dark:hover:bg-[#30363d] transition"
            title={isFullscreen ? "Exit Studio Fullscreen" : "Enter Studio Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ========================================================
          DUAL-PANE WORKSPACE: LEFT (PROBLEM) & RIGHT (CODE STUDIO)
          ======================================================== */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 ${isFullscreen ? "h-[calc(100vh-140px)]" : ""}`}>
        {/* ----------------------------------------------------
            LEFT PANE: PROBLEM STATEMENT, SPECS, & EXAMPLES
            ---------------------------------------------------- */}
        <div
          className={`lg:col-span-5 flex flex-col rounded-2xl overflow-hidden border shadow-sm ${
            isFullscreen
              ? "bg-[#161b22] border-[#30363d]"
              : "bg-[#f5f2eb] border-[#e6e1d8]"
          }`}
        >
          {/* Left Pane Navigation Tabs */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e6e1d8] dark:border-[#30363d] bg-[#ece7df]/70 dark:bg-[#0d1117]/60">
            <button
              type="button"
              onClick={() => setLeftTab("problem")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                leftTab === "problem"
                  ? "bg-[#161616] text-[#fbf9f6] dark:bg-[#30363d] dark:text-[#ffffff] shadow-sm"
                  : "text-[#6b6966] hover:text-[#161616] dark:hover:text-[#ffffff]"
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Description
            </button>

            <button
              type="button"
              onClick={() => setLeftTab("testcases")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                leftTab === "testcases"
                  ? "bg-[#161616] text-[#fbf9f6] dark:bg-[#30363d] dark:text-[#ffffff] shadow-sm"
                  : "text-[#6b6966] hover:text-[#161616] dark:hover:text-[#ffffff]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Testcases ({sampleCases.length})
            </button>

            <button
              type="button"
              onClick={() => setLeftTab("help")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                leftTab === "help"
                  ? "bg-[#161616] text-[#fbf9f6] dark:bg-[#30363d] dark:text-[#ffffff] shadow-sm"
                  : "text-[#6b6966] hover:text-[#161616] dark:hover:text-[#ffffff]"
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              I/O Guide
            </button>
          </div>

          {/* Left Pane Content Body (Scrollable) */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm leading-relaxed">
            {leftTab === "problem" && (
              <>
                <div>
                  <h1 className="font-editorial text-2xl font-bold text-[#161616] dark:text-[#f0f6fc] tracking-tight mb-3">
                    {(question as any).title || `Problem #${questionIndex + 1}`}
                  </h1>
                  <div className="text-sm text-[#3b3a38] dark:text-[#c9d1d9] whitespace-pre-wrap leading-relaxed">
                    {question.text}
                  </div>
                </div>

                {/* Example Walkthrough Cards */}
                {sampleCases.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#6b6966] dark:text-[#8b949e]">
                      Sample Testcases
                    </h3>
                    <div className="space-y-3">
                      {sampleCases.map((tc, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl p-4 bg-[#ece7df]/80 dark:bg-[#0d1117] border border-[#e6e1d8] dark:border-[#30363d] font-mono text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between text-[#6b6966] text-[11px] font-bold border-b border-[#dbdad7] dark:border-[#21262d] pb-1.5">
                            <span>Case {idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(tc.input, idx)}
                              className="hover:text-[#161616] dark:hover:text-white flex items-center gap-1"
                            >
                              {copiedInput === idx ? (
                                <>
                                  <CheckCheck className="w-3 h-3 text-emerald-500" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" /> Copy Input
                                </>
                              )}
                            </button>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[#8c8883] text-[10px] uppercase font-bold block">Input:</span>
                            <pre className="bg-[#fbf9f6] dark:bg-[#161b22] p-2 rounded-lg text-[#161616] dark:text-[#58a6ff] overflow-x-auto whitespace-pre-wrap">
                              {tc.input || "(empty)"}
                            </pre>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[#8c8883] text-[10px] uppercase font-bold block">Expected Output:</span>
                            <pre className="bg-[#fbf9f6] dark:bg-[#161b22] p-2 rounded-lg text-[#15803d] dark:text-[#7ee787] overflow-x-auto whitespace-pre-wrap">
                              {tc.expectedOutput}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Constraints Callout */}
                <div className="rounded-xl p-4 bg-[#ece7df]/60 dark:bg-[#0d1117]/80 border border-[#e6e1d8] dark:border-[#30363d] text-xs space-y-2">
                  <h4 className="font-bold text-[#161616] dark:text-[#f0f6fc] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Constraints & Execution Policy
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-[#6b6966] dark:text-[#8b949e]">
                    <li>Standard input via <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-[#dbdad7] dark:bg-[#21262d]">stdin</code>, output via <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-[#dbdad7] dark:bg-[#21262d]">stdout</code>.</li>
                    <li>Strict execution timeout of {question.timeLimitMs || 2000}ms applies to all cases.</li>
                    <li>Hidden evaluation test cases are evaluated upon clicking <strong>Submit Final Solution</strong>.</li>
                  </ul>
                </div>
              </>
            )}

            {leftTab === "testcases" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#161616] dark:text-[#f0f6fc]">
                  Visible Test Cases Detail
                </h3>
                {sampleCases.map((tc, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[#e6e1d8] dark:border-[#30363d] bg-[#ece7df]/70 dark:bg-[#0d1117] space-y-2 font-mono text-xs"
                  >
                    <div className="font-bold text-[#15803d] flex items-center justify-between">
                      <span>Test Case #{idx + 1}</span>
                      <span className="text-[11px] text-[#6b6966] font-normal">Sample Test Case</span>
                    </div>
                    <div>
                      <div className="text-[#6b6966] text-[10px] uppercase font-bold">Standard Input (stdin):</div>
                      <div className="p-2 rounded bg-[#fbf9f6] dark:bg-[#161b22] text-[#161616] dark:text-[#c9d1d9] mt-1 whitespace-pre-wrap">
                        {tc.input || "(no input)"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#6b6966] text-[10px] uppercase font-bold">Expected Standard Output:</div>
                      <div className="p-2 rounded bg-[#fbf9f6] dark:bg-[#161b22] text-[#15803d] dark:text-[#7ee787] mt-1 whitespace-pre-wrap">
                        {tc.expectedOutput}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {leftTab === "help" && (
              <div className="space-y-4 text-xs">
                <h3 className="text-sm font-bold text-[#161616] dark:text-[#f0f6fc]">
                  Standard Input / Output Boilerplates
                </h3>
                <div className="space-y-3 font-mono">
                  <div className="p-3 rounded-xl bg-[#ece7df] dark:bg-[#0d1117] border border-[#dbdad7] dark:border-[#30363d]">
                    <div className="font-bold text-[#15803d] mb-1">Python 3</div>
                    <pre className="text-[11px] text-[#161616] dark:text-[#79c0ff]">
                      {`import sys
input_data = sys.stdin.read().split()
print("result")`}
                    </pre>
                  </div>

                  <div className="p-3 rounded-xl bg-[#ece7df] dark:bg-[#0d1117] border border-[#dbdad7] dark:border-[#30363d]">
                    <div className="font-bold text-[#15803d] mb-1">JavaScript (Node.js)</div>
                    <pre className="text-[11px] text-[#161616] dark:text-[#79c0ff]">
                      {`const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
console.log("result");`}
                    </pre>
                  </div>

                  <div className="p-3 rounded-xl bg-[#ece7df] dark:bg-[#0d1117] border border-[#dbdad7] dark:border-[#30363d]">
                    <div className="font-bold text-[#15803d] mb-1">C++ (GCC)</div>
                    <pre className="text-[11px] text-[#161616] dark:text-[#79c0ff]">
                      {`#include <iostream>
using namespace std;
int main() {
    // your code
    return 0;
}`}
                    </pre>
                  </div>

                  <div className="p-3 rounded-xl bg-[#ece7df] dark:bg-[#0d1117] border border-[#dbdad7] dark:border-[#30363d]">
                    <div className="font-bold text-[#15803d] mb-1">Java</div>
                    <pre className="text-[11px] text-[#161616] dark:text-[#79c0ff]">
                      {`import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
    }
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------
            RIGHT PANE: CODE STUDIO + INTERACTIVE TERMINAL
            ---------------------------------------------------- */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl overflow-hidden border shadow-md bg-[#0d1117] border-[#30363d] text-[#e6edf3]">
          {/* Studio Canvas Header */}
          <div className="px-4 py-2.5 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-[#8b949e]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f85149]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#e3b341]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#2ea043]" />
              <span className="ml-2 text-[#c9d1d9] font-bold">Solution.{language === "python" ? "py" : language === "cpp" ? "cpp" : language === "java" ? "java" : "js"}</span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[#8b949e]">
              <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
              <span className="text-[#30363d]">|</span>
              <span>Spaces: 2</span>
              <span className="text-[#30363d]">|</span>
              <span className="flex items-center gap-1 text-[#3fb950]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
                Live Sync
              </span>
            </div>
          </div>

          {/* CODE EDITOR WITH SYNCHRONIZED GUTTER */}
          <div className="relative flex-1 flex bg-[#0d1117] min-h-[360px] overflow-hidden">
            {/* Line Numbers Gutter */}
            <div
              ref={gutterRef}
              className="w-12 py-4 select-none bg-[#0d1117] text-[#484f58] font-mono text-right pr-3 border-r border-[#21262d] overflow-hidden"
              style={{ fontSize: `${fontSize}px`, lineHeight: "1.6" }}
            >
              {linesArray.map((num) => (
                <div
                  key={num}
                  className={`${num === cursorPos.line ? "text-[#f0f6fc] font-bold" : ""}`}
                >
                  {num}
                </div>
              ))}
            </div>

            {/* Code Textarea Input */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => {
                onCodeChange(e.target.value);
                updateCursorPos();
              }}
              onKeyDown={handleEditorKeyDown}
              onKeyUp={updateCursorPos}
              onClick={updateCursorPos}
              onScroll={handleScroll}
              rows={18}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className="flex-1 p-4 bg-transparent text-[#e6edf3] font-mono focus:outline-none resize-none leading-[1.6] selection:bg-[#264f78]"
              style={{ fontSize: `${fontSize}px`, tabSize: 2 }}
              placeholder="// Write your solution here..."
            />
          </div>

          {/* ========================================================
              INTERACTIVE TESTCASE & TERMINAL CONSOLE DRAWER
              ======================================================== */}
          <div className="border-t border-[#30363d] bg-[#161b22] transition-all duration-200">
            {/* Console Drawer Header Bar */}
            <div className="px-4 py-2 flex items-center justify-between bg-[#161b22] border-b border-[#21262d]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConsoleTab("testcases");
                    setConsoleExpanded(true);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    consoleTab === "testcases"
                      ? "bg-[#21262d] text-[#58a6ff] border border-[#30363d]"
                      : "text-[#8b949e] hover:text-[#c9d1d9]"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Testcases
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConsoleTab("custom");
                    setConsoleExpanded(true);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    consoleTab === "custom"
                      ? "bg-[#21262d] text-[#58a6ff] border border-[#30363d]"
                      : "text-[#8b949e] hover:text-[#c9d1d9]"
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  Custom Input
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConsoleTab("results");
                    setConsoleExpanded(true);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    consoleTab === "results"
                      ? "bg-[#21262d] text-[#58a6ff] border border-[#30363d]"
                      : "text-[#8b949e] hover:text-[#c9d1d9]"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Console & Execution
                  {runResult && (
                    <span
                      className={`ml-1 w-2 h-2 rounded-full ${
                        runResult.success ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                      }`}
                    />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConsoleExpanded(!consoleExpanded)}
                  className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9]"
                  title={consoleExpanded ? "Collapse Console" : "Expand Console"}
                >
                  {consoleExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Console Drawer Body */}
            {consoleExpanded && (
              <div className="p-4 max-h-64 overflow-y-auto bg-[#0d1117] font-mono text-xs">
                {/* 1. TESTCASES TAB */}
                {consoleTab === "testcases" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {sampleCases.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedCaseIdx(idx)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                            selectedCaseIdx === idx
                              ? "bg-[#30363d] text-[#f0f6fc] border border-[#58a6ff]"
                              : "bg-[#161b22] text-[#8b949e] hover:text-[#c9d1d9]"
                          }`}
                        >
                          Case {idx + 1}
                        </button>
                      ))}
                    </div>

                    {sampleCases[selectedCaseIdx] && (
                      <div className="space-y-2 pt-1">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-[#8b949e] mb-1">Standard Input:</div>
                          <div className="p-2.5 rounded-lg bg-[#161b22] border border-[#30363d] text-[#c9d1d9] whitespace-pre-wrap">
                            {sampleCases[selectedCaseIdx].input || "(empty)"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-[#8b949e] mb-1">Expected Output:</div>
                          <div className="p-2.5 rounded-lg bg-[#161b22] border border-[#30363d] text-[#7ee787] whitespace-pre-wrap">
                            {sampleCases[selectedCaseIdx].expectedOutput}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. CUSTOM INPUT TAB */}
                {consoleTab === "custom" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[#8b949e] text-[11px]">
                      <span>Enter Custom Standard Input (stdin)</span>
                      <span>Will run against your custom data</span>
                    </div>
                    <textarea
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      rows={4}
                      className="w-full p-2.5 rounded-lg bg-[#161b22] border border-[#30363d] text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff] resize-none"
                      placeholder="Type custom input here (e.g., test numbers, strings)..."
                    />
                  </div>
                )}

                {/* 3. EXECUTION RESULTS TAB */}
                {consoleTab === "results" && (
                  <div>
                    {runningCode && (
                      <div className="flex flex-col items-center justify-center py-6 text-[#58a6ff] gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-xs font-semibold">Compiling & Executing in Docker Sandbox...</span>
                      </div>
                    )}

                    {!runningCode && !runResult && (
                      <div className="text-center py-6 text-[#8b949e]">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-[#21262d] text-[#c9d1d9] border border-[#30363d]">Ctrl + &apos;</kbd> to Run Sample Cases or <kbd className="px-1.5 py-0.5 rounded bg-[#21262d] text-[#c9d1d9] border border-[#30363d]">Ctrl + ↵</kbd> to Submit.
                      </div>
                    )}

                    {!runningCode && runResult && (
                      <div className="space-y-3">
                        {/* Overall Result Banner */}
                        <div
                          className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                            runResult.success
                              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400"
                              : "bg-red-950/40 border-red-500/40 text-red-400"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {runResult.success ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-400" />
                            )}
                            <div>
                              <span className="font-bold text-sm tracking-wide">
                                {runResult.success ? "ACCEPTED" : "WRONG ANSWER / EXECUTION ERROR"}
                              </span>
                              <div className="text-[11px] opacity-80">
                                {runResult.passedCount} of {runResult.totalCount} test cases passed
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2.5 py-1 rounded bg-[#161b22] border border-[#30363d] text-[#c9d1d9]">
                              ⚡ {runResult.results?.[0]?.runtimeMs || 12}ms
                            </span>
                            <span className="px-2.5 py-1 rounded bg-[#161b22] border border-[#30363d] text-[#c9d1d9]">
                              💾 14.8MB
                            </span>
                          </div>
                        </div>

                        {/* Compilation Error Block */}
                        {runResult.compilationError && (
                          <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 text-red-300 whitespace-pre-wrap text-xs">
                            <div className="font-bold text-red-400 mb-1">Compilation / Syntax Error:</div>
                            {runResult.compilationError}
                          </div>
                        )}

                        {/* Detailed Case Cards */}
                        <div className="space-y-2">
                          {runResult.results?.map((res: any, idx: number) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                                res.passed
                                  ? "bg-[#161b22] border-emerald-500/30 text-[#c9d1d9]"
                                  : "bg-[#161b22] border-red-500/30 text-[#c9d1d9]"
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className={`flex items-center gap-1.5 ${res.passed ? "text-emerald-400" : "text-red-400"}`}>
                                  {res.passed ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                  Test Case #{idx + 1} {res.isHidden ? "(Hidden Evaluation)" : ""}
                                </span>
                                <span className="text-[11px] text-[#8b949e]">
                                  {res.runtimeMs}ms
                                </span>
                              </div>

                              {!res.isHidden && (
                                <div className="space-y-1 text-[11px] pt-1 border-t border-[#21262d]">
                                  <div>
                                    <span className="text-[#8b949e]">Input:</span> <span className="text-[#58a6ff]">{res.input || "(empty)"}</span>
                                  </div>
                                  {res.expectedOutput && (
                                    <div>
                                      <span className="text-[#8b949e]">Expected:</span> <span className="text-[#7ee787]">{res.expectedOutput}</span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-[#8b949e]">Your Output:</span>{" "}
                                    <span className={res.passed ? "text-[#7ee787]" : "text-red-400 font-bold"}>
                                      {res.actualOutput || "(no output)"}
                                    </span>
                                  </div>
                                  {res.error && (
                                    <div className="text-red-400 text-[10px]">
                                      Error: {res.error}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="px-4 py-3 bg-[#161b22] border-t border-[#30363d] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#8b949e] flex items-center gap-2">
                <Keyboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Shortcuts:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#21262d] text-[#c9d1d9] border border-[#30363d] text-[10px]">
                  Ctrl + &apos;
                </kbd>
                <span className="text-[10px]">Run</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#21262d] text-[#c9d1d9] border border-[#30363d] text-[10px]">
                  Ctrl + Enter
                </kbd>
                <span className="text-[10px]">Submit</span>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Run Sample Cases Button */}
                <button
                  type="button"
                  onClick={() => onRunCode(consoleTab === "custom" ? customInput : undefined)}
                  disabled={runningCode || submitting}
                  className="px-4 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-[#f0f6fc] font-bold text-xs transition flex items-center gap-2 border border-[#30363d] shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {runningCode ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#58a6ff]" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-[#3fb950] fill-[#3fb950]" />
                      Run Sample Cases
                    </>
                  )}
                </button>

                {/* Submit Solution Button */}
                <button
                  type="button"
                  onClick={onSubmitCode}
                  disabled={runningCode || submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#1f883d] to-[#2ea043] hover:from-[#1a7f37] hover:to-[#2c974b] text-white font-extrabold text-xs transition flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Grading Solution...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Submit Final Solution
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
