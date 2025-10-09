'use client';

import React, { useState } from 'react';
import { Bold, Italic, List, Minus, Type, Eye, EyeOff } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Enter description...",
  className = ""
}) => {
  const [showPreview, setShowPreview] = useState(false);

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('rich-text-input') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
    onChange(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const insertBulletPoint = () => {
    const textarea = document.getElementById('rich-text-input') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // If no text is selected, just insert a single bullet point
    if (start === end) {
      const beforeCursor = value.substring(0, start);
      const afterCursor = value.substring(start);
      
      // Check if we're at the start of a line
      const isStartOfLine = start === 0 || beforeCursor.endsWith('\n');
      const bullet = isStartOfLine ? '• ' : '\n• ';
      
      const newText = beforeCursor + bullet + afterCursor;
      onChange(newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + bullet.length, start + bullet.length);
      }, 0);
      return;
    }

    // Handle multiple lines selection
    const beforeSelection = value.substring(0, start);
    const selectedText = value.substring(start, end);
    const afterSelection = value.substring(end);
    
    // Split selected text into lines
    const lines = selectedText.split('\n');
    
    // Apply bullet points to each line that doesn't already have one
    const bulletedLines = lines.map(line => {
      const trimmedLine = line.trim();
      if (trimmedLine === '') return line; // Keep empty lines as is
      if (trimmedLine.startsWith('• ')) return line; // Already has bullet
      
      // Find the indentation of the original line
      const leadingWhitespace = line.match(/^[\s]*/)?.[0] || '';
      return leadingWhitespace + '• ' + trimmedLine;
    });
    
    const newSelectedText = bulletedLines.join('\n');
    const newText = beforeSelection + newSelectedText + afterSelection;
    
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      // Select the modified text
      const newSelectionStart = start;
      const newSelectionEnd = start + newSelectedText.length;
      textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
    }, 0);
  };

  const insertDivider = () => {
    const textarea = document.getElementById('rich-text-input') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const beforeCursor = value.substring(0, start);
    const afterCursor = value.substring(start);
    
    const isStartOfLine = start === 0 || beforeCursor.endsWith('\n');
    const divider = isStartOfLine ? '---\n' : '\n---\n';
    
    const newText = beforeCursor + divider + afterCursor;
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + divider.length, start + divider.length);
    }, 0);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-slate-800/50 border border-slate-600 rounded-t-md p-2">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => insertFormatting('**', '**')}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('*', '*')}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-slate-600 mx-1"></div>
          <button
            type="button"
            onClick={insertBulletPoint}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Bullet Point"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={insertDivider}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Divider"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center space-x-1 p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title={showPreview ? "Edit" : "Preview"}
        >
          {showPreview ? <Type className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="text-xs">{showPreview ? "Edit" : "Preview"}</span>
        </button>
      </div>

      {/* Input/Preview Area */}
      {showPreview ? (
        <div className="min-h-[120px] p-3 bg-slate-700/50 border border-slate-600 border-t-0 rounded-b-md text-white">
          <FormattedText text={value} />
        </div>
      ) : (
        <textarea
          id="rich-text-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 border-t-0 text-white rounded-b-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
          placeholder={placeholder}
          rows={6}
        />
      )}

    </div>
  );
};

// Component to render formatted text
export const FormattedText: React.FC<{ text: string; className?: string }> = ({ 
  text, 
  className = "" 
}) => {
  if (!text) return null;

  const formatText = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Handle dividers
      if (line.trim() === '---') {
        elements.push(
          <div key={i} className="border-t border-slate-500/50 my-3"></div>
        );
        continue;
      }

      // Handle bullet points
      if (line.trim().startsWith('• ')) {
        const bulletText = line.replace(/^[\s]*•[\s]*/, '');
        elements.push(
          <div key={i} className="flex items-start space-x-2 mb-1">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
            <span>{formatInlineText(bulletText)}</span>
          </div>
        );
        continue;
      }

      // Handle regular lines
      if (line.trim()) {
        elements.push(
          <div key={i} className="mb-2">
            {formatInlineText(line)}
          </div>
        );
      } else {
        elements.push(<div key={i} className="mb-2"></div>);
      }
    }

    return elements;
  };

  const formatInlineText = (text: string) => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    
    // Handle bold text (**text**)
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        const beforeText = text.substring(currentIndex, match.index);
        parts.push(formatItalicText(beforeText, parts.length));
      }
      
      // Add bold text
      parts.push(
        <strong key={parts.length} className="font-semibold text-white">
          {formatItalicText(match[1], parts.length)}
        </strong>
      );
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      parts.push(formatItalicText(remainingText, parts.length));
    }
    
    return parts.length > 0 ? parts : text;
  };

  const formatItalicText = (text: string, keyPrefix: number) => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    
    // Handle italic text (*text*)
    const italicRegex = /\*([^*]+?)\*/g;
    let match;
    
    while ((match = italicRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        parts.push(text.substring(currentIndex, match.index));
      }
      
      // Add italic text
      parts.push(
        <em key={`${keyPrefix}-${parts.length}`} className="italic text-slate-200">
          {match[1]}
        </em>
      );
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={`text-slate-300 leading-relaxed ${className}`}>
      {formatText(text)}
    </div>
  );
};