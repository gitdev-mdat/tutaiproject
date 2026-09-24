'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Link2,
  Download,
} from 'lucide-react';
import { KnowledgeImportSession, ImportCandidate } from '@/lib/knowledge-graph/kg-import-types';

export function ImportManager() {
  const [sessions, setSessions] = useState<KnowledgeImportSession[]>([]);
  const [activeSession, setActiveSession] = useState<KnowledgeImportSession | null>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState('');

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/knowledge-import/sessions');
      if (res.ok) {
        setSessions(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      await fetchSessions();
      const requestedSessionId = new URLSearchParams(window.location.search).get('session');
      if (requestedSessionId) {
        const res = await fetch(`/api/knowledge-import/sessions/${requestedSessionId}`);
        if (res.ok) {
          const data = await res.json();
          setActiveSession(data.session);
          setCandidates(data.candidates);
        }
      }
    }
    init();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch('/api/knowledge-import/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, filename: file.name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      fetchSessions();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setUploadError(err.message);
      } else {
        setUploadError(String(err));
      }
    }
  };

  const handleDownloadPilot = async () => {
    const res = await fetch('/api/knowledge-import/example');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pilot-import.json';
    a.click();
  };

  const openSession = async (id: string) => {
    const res = await fetch(`/api/knowledge-import/sessions/${id}`);
    if (res.ok) {
      const data = await res.json();
      setActiveSession(data.session);
      setCandidates(data.candidates);
    }
  };

  const runValidation = async () => {
    if (!activeSession) return;
    await fetch(`/api/knowledge-import/sessions/${activeSession.id}/validate`, { method: 'POST' });
    openSession(activeSession.id);
  };

  const commitSession = async () => {
    if (!activeSession) return;
    if (
      !confirm(
        'Bạn có chắc chắn muốn commit phiên import này? Thay đổi sẽ được áp dụng vào Knowledge Graph chính.'
      )
    )
      return;
    try {
      const res = await fetch(`/api/knowledge-import/sessions/${activeSession.id}/commit`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        alert('Commit thất bại: ' + data.error);
      } else {
        alert('Commit thành công!');
      }
      openSession(activeSession.id);
      fetchSessions();
    } catch (e: unknown) {
      if (e instanceof Error) {
        alert('Lỗi: ' + e.message);
      }
    }
  };

  const updateCandidate = async (
    candidateId: string,
    status?: string,
    matchedCanonicalId?: string,
    sourceData?: Record<string, unknown>
  ) => {
    try {
      const res = await fetch(`/api/knowledge-import/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, matchedCanonicalId, sourceData }),
      });
      if (res.ok) {
        openSession(activeSession!.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const candidateStatusLabel = (status: ImportCandidate['status']) => {
    const labels: Partial<Record<ImportCandidate['status'], string>> = {
      NEEDS_REVIEW: 'Chờ quyết định',
      APPROVED_CREATE: 'Đã duyệt tạo Concept',
      APPROVED_LINK: 'Đã duyệt liên kết',
      APPROVED_UPDATE: 'Đã duyệt cập nhật',
      REJECTED: 'Đã từ chối',
      BLOCKED: 'Đang bị chặn',
    };
    return labels[status] ?? status;
  };

  const renderCandidateAction = (c: ImportCandidate) => {
    if (activeSession?.status === 'COMPLETED' || activeSession?.status === 'COMMITTING') {
      return (
        <Badge variant="outline" className="bg-slate-100">
          {candidateStatusLabel(c.status)}
          {c.matchedCanonicalId ? ` → ${c.matchedCanonicalId}` : ''}
        </Badge>
      );
    }

    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => updateCandidate(c.id, 'APPROVED_CREATE')}
        >
          Tạo mới (Create)
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => updateCandidate(c.id, 'APPROVED_LINK')}
        >
          Liên kết (Link)
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs"
          onClick={() => updateCandidate(c.id, 'REJECTED')}
        >
          Từ chối (Reject)
        </Button>
      </div>
    );
  };

  if (activeSession) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Session Header */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-slate-500"
                onClick={() => {
                  setActiveSession(null);
                  fetchSessions();
                }}
              >
                &larr; Trở về
              </Button>
              <h2 className="text-lg font-bold text-slate-800">{activeSession.title}</h2>
              <Badge variant={activeSession.status === 'COMPLETED' ? 'default' : 'secondary'}>
                {activeSession.status === 'READY_TO_COMMIT'
                  ? 'Sẵn sàng commit'
                  : activeSession.status === 'REVIEW_REQUIRED'
                    ? 'Cần kiểm duyệt'
                    : activeSession.status}
              </Badge>
            </div>
            <div className="text-xs text-slate-500 ml-10">
              {activeSession.sourceName} • {activeSession.summary.unresolved} chưa quyết định •{' '}
              {activeSession.summary.approved} đã duyệt
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeSession.status === 'PARSING' || activeSession.status === 'REVIEW_REQUIRED' ? (
              <Button onClick={runValidation} variant="outline" className="bg-white">
                <RefreshCw className="w-4 h-4 mr-2" /> Đối chiếu graph hiện tại
              </Button>
            ) : null}
            <Button
              onClick={commitSession}
              disabled={activeSession.status !== 'READY_TO_COMMIT'}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Commit vào Knowledge Graph
            </Button>
          </div>
        </div>

        {/* Candidate List */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-4">
            {candidates.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="uppercase text-[10px] bg-slate-50">
                      {c.entityType}
                    </Badge>
                    <span className="font-semibold text-slate-800">
                      {String(
                        (c.sourceData as Record<string, string>).title ||
                          (c.sourceData as Record<string, string>).statement ||
                          (c.sourceData as Record<string, string>).sourceConceptSourceKey ||
                          ''
                      )}
                    </span>
                  </div>
                  <div>
                    <Badge
                      variant={
                        c.status.startsWith('APPROVED') || c.status === 'AUTO_MATCHED'
                          ? 'default'
                          : c.status === 'REJECTED'
                            ? 'destructive'
                            : c.status === 'NEEDS_REVIEW'
                              ? 'secondary'
                              : 'outline'
                      }
                      className={
                        c.status.startsWith('APPROVED') || c.status === 'AUTO_MATCHED'
                          ? 'bg-emerald-500'
                          : ''
                      }
                    >
                      {c.status}
                    </Badge>
                  </div>
                </div>

                {/* Warnings / Match Reasons */}
                {c.validationWarnings && c.validationWarnings.length > 0 && (
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <div>{c.validationWarnings.join(' ')}</div>
                  </div>
                )}

                {c.matchReasons && c.matchReasons.length > 0 && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded-md flex gap-2">
                    <Link2 className="w-4 h-4 shrink-0" />
                    <div>{c.matchReasons.join(' ')}</div>
                  </div>
                )}

                {/* Data Preview */}
                <div className="text-[11px] font-mono bg-slate-50 p-2 rounded text-slate-600 overflow-x-auto">
                  {JSON.stringify(c.sourceData)}
                </div>

                {/* Actions */}
                <div className="flex justify-end border-t border-slate-100 pt-3 mt-1">
                  {renderCandidateAction(c)}
                </div>
              </div>
            ))}

            {candidates.length === 0 && (
              <div className="text-center text-slate-400 py-12">
                Chưa có ứng viên (Candidates) nào. Vui lòng nhấn &quot;Chạy đối chiếu&quot;.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto bg-slate-50/50">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Controlled Knowledge Import
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Quản lý và kiểm duyệt dữ liệu nhập vào Knowledge Graph (Phase 3)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleDownloadPilot} className="bg-white">
              <Download className="w-4 h-4 mr-2 text-slate-400" /> Tải Pilot JSON
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button className="pointer-events-none">
                <Upload className="w-4 h-4 mr-2" /> Tải lên JSON
              </Button>
            </div>
          </div>
        </div>

        {uploadError && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2 border border-red-100">
            <AlertCircle className="w-4 h-4" /> {uploadError}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Phiên Import gần đây</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">Đang tải...</div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Chưa có phiên Import nào. Bắt đầu bằng cách tải lên file JSON.
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <div className="font-medium text-slate-800">{s.title}</div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <FileJson className="w-3 h-3" /> {s.sourceName}
                      </span>
                      <span>{new Date(s.createdAt).toLocaleString('vi-VN')}</span>
                      <span>{s.summary.totalCandidates} mục</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={
                        s.status === 'COMPLETED'
                          ? 'default'
                          : s.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {s.status}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => openSession(s.id)}>
                      {s.status === 'COMPLETED' ? 'Xem chi tiết' : 'Kiểm duyệt'} &rarr;
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
