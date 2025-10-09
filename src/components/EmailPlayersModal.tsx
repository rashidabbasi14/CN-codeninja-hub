"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mail, X } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { RichTextEditor } from "@/components/RichTextEditor";

interface EmailPlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
  allGames?: any[];
  defaultRecipientType?: 'all' | 'game' | 'custom';
  defaultSubject?: string;
  defaultContent?: string;
  defaultCustomEmails?: string | string[];
  title?: string;
  description?: string;
}

export default function EmailPlayersModal({
  isOpen,
  onClose,
  onSuccess,
  allGames = [],
  defaultRecipientType = 'custom',
  defaultSubject = '',
  defaultContent = '',
  defaultCustomEmails = '',
  title = 'Email All Players',
  description = 'Send an email to all registered players in the system'
}: EmailPlayersModalProps) {
  const { apiCall } = useUser();
  const [emailSubject, setEmailSubject] = useState(defaultSubject);
  const [emailContent, setEmailContent] = useState(defaultContent);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [recipientType, setRecipientType] = useState<'all' | 'game' | 'custom'>(defaultRecipientType);
  const [selectedGameId, setSelectedGameId] = useState<string>('all');
  const [customEmails, setCustomEmails] = useState<string>('');

  // Initialize form with default values when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmailSubject(defaultSubject);
      setEmailContent(defaultContent);
      setRecipientType(defaultRecipientType);
      
      // Handle customEmails as either string or array
      if (Array.isArray(defaultCustomEmails)) {
        setCustomEmails(defaultCustomEmails.join(', '));
      } else {
        setCustomEmails(defaultCustomEmails);
      }
    }
  }, [isOpen, defaultSubject, defaultContent, defaultRecipientType, defaultCustomEmails]);

  const validateCustomEmails = (emailString: string): { valid: boolean; emails: string[]; errors: string[] } => {
    const emails = emailString.split(',').map(email => email.trim()).filter(email => email.length > 0);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails: string[] = [];
    const errors: string[] = [];

    emails.forEach(email => {
      if (emailRegex.test(email)) {
        validEmails.push(email);
      } else {
        errors.push(email);
      }
    });

    return {
      valid: errors.length === 0 && validEmails.length > 0,
      emails: validEmails,
      errors
    };
  };

  const getEmailPreview = async () => {
    try {
      const response = await apiCall('/api/admin/email-players/preview', {
        method: 'POST',
        body: JSON.stringify({
          recipientType,
          gameId: recipientType === 'game' ? selectedGameId : undefined,
          customEmails: recipientType === 'custom' ? customEmails : undefined
        })
      });

      if (response.ok) {
        return await response.json();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get email preview');
      }
    } catch (error) {
      console.error('Error getting email preview:', error);
      throw error;
    }
  };

  const handleSendEmailToPlayers = async () => {
    if (!emailSubject.trim() || !emailContent.trim()) {
      alert('Please fill in both subject and content fields.');
      return;
    }

    if (recipientType === 'game' && selectedGameId === 'all') {
      alert('Please select a specific game for game-based emails.');
      return;
    }

    if (recipientType === 'custom') {
      if (!customEmails.trim()) {
        alert('Please enter email addresses for custom recipients.');
        return;
      }
      
      const validation = validateCustomEmails(customEmails);
      if (!validation.valid) {
        if (validation.errors.length > 0) {
          alert(`Invalid email addresses found: ${validation.errors.join(', ')}`);
          return;
        }
        if (validation.emails.length === 0) {
          alert('Please enter at least one valid email address.');
          return;
        }
      }
    }

    // Get recipient preview and show confirmation
    try {
      setSendingEmail(true);
      const preview = await getEmailPreview();
      setSendingEmail(false);

      // Create confirmation message
      let confirmationMessage = `Send email to ${preview.recipientCount} recipients?\n\n`;
      confirmationMessage += `Subject: ${emailSubject}\n`;
      confirmationMessage += `Recipients: ${preview.recipientInfo}\n`;
      confirmationMessage += `Total Count: ${preview.recipientCount}\n\n`;
      
      if (preview.recipients && preview.recipients.length > 0) {
        confirmationMessage += `Sample recipients:\n`;
        preview.recipients.slice(0, 5).forEach((recipient: any) => {
          if (recipient.firstName && recipient.lastName) {
            confirmationMessage += `• ${recipient.firstName} ${recipient.lastName} (${recipient.email})\n`;
          } else {
            confirmationMessage += `• ${recipient.email}\n`;
          }
        });
        
        if (preview.hasMore) {
          confirmationMessage += `• ... and ${preview.recipientCount - 5} more recipients\n`;
        }
      }

      const confirmed = confirm(confirmationMessage);
      if (!confirmed) {
        return;
      }

      // Proceed with sending email
      setSendingEmail(true);
      const response = await apiCall('/api/admin/email-players', {
        method: 'POST',
        body: JSON.stringify({
          subject: emailSubject,
          content: emailContent,
          recipientType,
          gameId: recipientType === 'game' ? selectedGameId : undefined,
          customEmails: recipientType === 'custom' ? customEmails : undefined
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Email sent successfully to ${result.recipientCount} recipients!`);
        handleClose();
        if (onSuccess) {
          onSuccess(result);
        }
      } else {
        const error = await response.json();
        let errorMessage = 'Failed to send email: ' + (error.error || 'Unknown error');
        
        // Add suggestion if provided
        if (error.suggestion) {
          errorMessage += '\n\nSuggestion: ' + error.suggestion;
        }
        
        // Add recipient count info if available
        if (error.recipientCount) {
          errorMessage += `\n\nAttempted to send to ${error.recipientCount} recipients.`;
        }
        
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleClose = () => {
    setEmailSubject('');
    setEmailContent('');
    setRecipientType('custom');
    setSelectedGameId('all');
    setCustomEmails('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-xl shadow-2xl">
        <CardHeader className="border-b border-slate-700 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-xl font-bold flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-400" />
                {title}
              </CardTitle>
              <CardDescription className="text-slate-300 mt-2">
                {description}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Recipients *
            </label>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="custom"
                    checked={recipientType === 'custom'}
                    onChange={(e) => setRecipientType(e.target.value as 'all' | 'game' | 'custom')}
                    className="text-blue-600 focus:ring-blue-500"
                    disabled={sendingEmail}
                  />
                  <span className="text-slate-300">Custom Emails</span>
                </label>

                {allGames.length > 0 && (
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipientType"
                      value="game"
                      checked={recipientType === 'game'}
                      onChange={(e) => setRecipientType(e.target.value as 'all' | 'game' | 'custom')}
                      className="text-blue-600 focus:ring-blue-500"
                      disabled={sendingEmail}
                    />
                    <span className="text-slate-300">Game Based</span>
                  </label>
                )}

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="all"
                    checked={recipientType === 'all'}
                    onChange={(e) => setRecipientType(e.target.value as 'all' | 'game' | 'custom')}
                    className="text-blue-600 focus:ring-blue-500"
                    disabled={sendingEmail}
                  />
                  <span className="text-slate-300">All Users</span>
                </label>
              </div>
              
              {recipientType === 'game' && allGames.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select Game *
                  </label>
                  <select
                    value={selectedGameId}
                    onChange={(e) => setSelectedGameId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={sendingEmail}
                  >
                    <option value="all">Select a game...</option>
                    {allGames.map((game) => (
                      <option key={game.id} value={game.id}>
                        {game.displayName || game.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {recipientType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email Addresses *
                  </label>
                  <textarea
                    value={customEmails}
                    onChange={(e) => setCustomEmails(e.target.value)}
                    placeholder="Enter email addresses separated by commas (e.g., user1@example.com, user2@example.com)"
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                    disabled={sendingEmail}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Separate multiple email addresses with commas
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Subject *
            </label>
            <Input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
              disabled={sendingEmail}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Message Content *
            </label>
            <RichTextEditor
              value={emailContent}
              onChange={setEmailContent}
              placeholder="Enter your message content here..."
              className={sendingEmail ? "opacity-50 pointer-events-none" : ""}
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-slate-700">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleClose}
              disabled={sendingEmail}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmailToPlayers}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
              disabled={sendingEmail || !emailSubject.trim() || !emailContent.trim() ||
                (recipientType === 'game' && selectedGameId === 'all') ||
                (recipientType === 'custom' && !customEmails.trim())}
            >
              {sendingEmail ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}