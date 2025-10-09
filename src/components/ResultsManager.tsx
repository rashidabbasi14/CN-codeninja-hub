
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Trophy, 
  Users, 
  Clock, 
  MapPin, 
  Save, 
  CheckCircle, 
  AlertCircle,
  Medal,
  Target,
  Flag
} from "lucide-react";

interface Match {
  id: string;
  gameId: string;
  gameName: string;
  gameWeightage: number;
  slotId: string;
  startTime: Date;
  endTime: Date;
  venueName: string;
  courtName: string;
  participantA: {
    id: string;
    name: string;
    type: 'individual' | 'team';
    members?: string[];
  };
  participantB: {
    id: string;
    name: string;
    type: 'individual' | 'team';
    members?: string[];
  };
  winner?: {
    id: string;
    name: string;
  };
  scoreA?: number;
  scoreB?: number;
  notes?: string;
  overtime?: boolean;
  penalty?: boolean;
  walkover?: boolean;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

interface ResultsManagerProps {
  matches: Match[];
  onResultSubmit: (matchId: string, result: MatchResult) => Promise<void>;
  onBulkResultSubmit: (results: { matchId: string; result: MatchResult }[]) => Promise<void>;
}

interface MatchResult {
  winnerId: string;
  scoreA?: number;
  scoreB?: number;
  notes?: string;
  overtime?: boolean;
  penalty?: boolean;
  walkover?: boolean;
}

function MatchCard({ 
  match, 
  onResultSubmit, 
  isEditing, 
  onEditToggle 
}: { 
  match: Match; 
  onResultSubmit: (result: MatchResult) => Promise<void>;
  isEditing: boolean;
  onEditToggle: () => void;
}) {
  const [result, setResult] = useState<MatchResult>({
    winnerId: match.winner?.id || '',
    scoreA: match.scoreA || 0,
    scoreB: match.scoreB || 0,
    notes: match.notes || '',
    overtime: match.overtime || false,
    penalty: match.penalty || false,
    walkover: match.walkover || false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!result.winnerId) {
      alert('Please select a winner');
      return;
    }

    setIsSubmitting(true);
    try {
      await onResultSubmit(result);
      onEditToggle();
    } catch (error) {
      console.error('Failed to submit result:', error);
      alert('Failed to submit result. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-400" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-500/50 bg-green-500/10';
      case 'in_progress':
        return 'border-blue-500/50 bg-blue-500/10';
      case 'cancelled':
        return 'border-red-500/50 bg-red-500/10';
      default:
        return 'border-slate-600 bg-slate-700/50';
    }
  };

  return (
    <Card className={`${getStatusColor(match.status)} transition-all duration-200`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-orange-400" />
            <span>{match.gameName}</span>
            <div className="flex items-center space-x-1 text-sm text-slate-400">
              <Medal className="h-4 w-4" />
              <span>{match.gameWeightage}pts</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon(match.status)}
            <span className="text-sm text-slate-400 capitalize">{match.status.replace('_', ' ')}</span>
          </div>
        </CardTitle>
        
        <div className="flex items-center justify-between text-sm text-slate-400">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>
                {match.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                {match.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <MapPin className="h-3 w-3" />
              <span>{match.venueName} - {match.courtName}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Participants */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Participant A */}
          <div className={`p-3 rounded-lg border ${
            match.winner?.id === match.participantA.id 
              ? 'border-green-500 bg-green-500/20' 
              : 'border-slate-600 bg-slate-700/50'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="font-medium text-white">{match.participantA.name}</span>
              {match.winner?.id === match.participantA.id && (
                <Trophy className="h-4 w-4 text-yellow-400" />
              )}
            </div>
            {match.participantA.members && (
              <div className="text-xs text-slate-400">
                {match.participantA.members.join(', ')}
              </div>
            )}
            {match.status === 'completed' && (
              <div className="text-lg font-bold text-white mt-2">
                {match.scoreA || 0}
              </div>
            )}
          </div>

          {/* VS */}
          <div className="flex items-center justify-center">
            <div className="text-slate-400 font-bold">VS</div>
          </div>

          {/* Participant B */}
          <div className={`p-3 rounded-lg border ${
            match.winner?.id === match.participantB.id 
              ? 'border-green-500 bg-green-500/20' 
              : 'border-slate-600 bg-slate-700/50'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="font-medium text-white">{match.participantB.name}</span>
              {match.winner?.id === match.participantB.id && (
                <Trophy className="h-4 w-4 text-yellow-400" />
              )}
            </div>
            {match.participantB.members && (
              <div className="text-xs text-slate-400">
                {match.participantB.members.join(', ')}
              </div>
            )}
            {match.status === 'completed' && (
              <div className="text-lg font-bold text-white mt-2">
                {match.scoreB || 0}
              </div>
            )}
          </div>
        </div>

        {/* Match Flags */}
        {(match.overtime || match.penalty || match.walkover) && (
          <div className="flex items-center space-x-2 mb-4">
            {match.overtime && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                <Clock className="h-3 w-3" />
                <span>Overtime</span>
              </div>
            )}
            {match.penalty && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                <Target className="h-3 w-3" />
                <span>Penalty</span>
              </div>
            )}
            {match.walkover && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                <Flag className="h-3 w-3" />
                <span>Walkover</span>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {match.notes && (
          <div className="mb-4 p-2 bg-slate-800/50 rounded text-sm text-slate-300">
            <strong>Notes:</strong> {match.notes}
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <div className="space-y-4 border-t border-slate-600 pt-4">
            {/* Winner Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Winner</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={result.winnerId === match.participantA.id ? "default" : "outline"}
                  onClick={() => setResult({ ...result, winnerId: match.participantA.id })}
                  className="justify-start"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  {match.participantA.name}
                </Button>
                <Button
                  variant={result.winnerId === match.participantB.id ? "default" : "outline"}
                  onClick={() => setResult({ ...result, winnerId: match.participantB.id })}
                  className="justify-start"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  {match.participantB.name}
                </Button>
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {match.participantA.name} Score
                </label>
                <Input
                  type="number"
                  min="0"
                  value={result.scoreA || 0}
                  onChange={(e) => setResult({ ...result, scoreA: parseInt(e.target.value) || 0 })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {match.participantB.name} Score
                </label>
                <Input
                  type="number"
                  min="0"
                  value={result.scoreB || 0}
                  onChange={(e) => setResult({ ...result, scoreB: parseInt(e.target.value) || 0 })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            {/* Flags */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={result.overtime}
                  onChange={(e) => setResult({ ...result, overtime: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-slate-300">Overtime</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={result.penalty}
                  onChange={(e) => setResult({ ...result, penalty: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-slate-300">Penalty</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={result.walkover}
                  onChange={(e) => setResult({ ...result, walkover: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-slate-300">Walkover</span>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
              <textarea
                value={result.notes}
                onChange={(e) => setResult({ ...result, notes: e.target.value })}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                rows={3}
                placeholder="Optional match notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !result.winnerId}
                className="codeninja-gradient"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save Result'}
              </Button>
              <Button variant="outline" onClick={onEditToggle}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isEditing && match.status !== 'completed' && (
          <div className="flex items-center space-x-2 pt-4 border-t border-slate-600">
            <Button onClick={onEditToggle} className="codeninja-gradient">
              {match.status === 'scheduled' ? 'Enter Result' : 'Update Result'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResultsManager({ matches, onResultSubmit, onBulkResultSubmit }: ResultsManagerProps) {
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMatches = matches.filter(match => {
    const matchesFilter = filter === 'all' || match.status === filter;
    const matchesSearch = searchTerm === '' ||
      match.gameName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.participantA.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.participantB.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const handleResultSubmit = async (matchId: string, result: MatchResult) => {
    await onResultSubmit(matchId, result);
    setEditingMatch(null);
  };

  const getFilterCounts = () => {
    return {
      all: matches.length,
      scheduled: matches.filter(m => m.status === 'scheduled').length,
      in_progress: matches.filter(m => m.status === 'in_progress').length,
      completed: matches.filter(m => m.status === 'completed').length,
      cancelled: matches.filter(m => m.status === 'cancelled').length,
    };
  };

  const counts = getFilterCounts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Match Results</h2>
          <p className="text-slate-400">Manage match results and winners</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Input
            placeholder="Search matches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 bg-slate-700 border-slate-600 text-white"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'scheduled', label: 'Scheduled', count: counts.scheduled },
          { key: 'in_progress', label: 'In Progress', count: counts.in_progress },
          { key: 'completed', label: 'Completed', count: counts.completed },
          { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
        ].map(({ key, label, count }) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key as any)}
            className="whitespace-nowrap"
          >
            {label} ({count})
          </Button>
        ))}
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="text-center py-12">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-medium text-white mb-2">No matches found</h3>
            <p className="text-slate-400">
              {searchTerm ? 'Try adjusting your search terms.' : 'No matches match the current filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onResultSubmit={(result) => handleResultSubmit(match.id, result)}
              isEditing={editingMatch === match.id}
              onEditToggle={() => setEditingMatch(editingMatch === match.id ? null : match.id)}
            />
          ))}
        </div>
      )}

      {/* Bulk Actions */}
      {filteredMatches.some(m => m.status === 'scheduled' || m.status === 'in_progress') && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => {
                  // Implement bulk result entry
                  alert('Bulk result entry coming soon!');
                }}
              >
                <Save className="h-4 w-4 mr-2" />
                Bulk Enter Results
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Implement export functionality
                  alert('Export results coming soon!');
                }}
              >
                Export Results
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}