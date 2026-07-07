import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Header from '../components/Header';
import SortTh from '../components/SortTh';
import { useSortableData } from '../hooks/useSortableData';
import { useAuth } from '../auth';
import { useT } from '../i18n';

interface Visit {
  id: string;
  visitType: string;
  targetType: string;
  visitorType: string;
  memberId?: string;
  memberName?: string;
  familyId?: string;
  familyName?: string;
  visitorUserId: string;
  visitorName?: string;
  visitDate: string;
  notes?: string;
  purpose?: string;
  outcome?: string;
  nextActionDate?: string;
  followUpRequired: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface CreateVisitData {
  visitType: string;
  targetType: string;
  visitorType: string;
  memberId?: string;
  familyId?: string;
  visitDate: string;
  notes?: string;
  purpose?: string;
  outcome?: string;
  nextActionDate?: string;
  followUpRequired: boolean;
}

interface Family {
  id: string;
  familyName: string;
}

interface Member {
  id: string;
  fullName: string;
  familyId: string;
}

export default function Visits() {
  const auth = useAuth();
  const { t } = useT();
  const isServant = auth.hasRole('Servant');

  const [visits, setVisits] = useState<Visit[]>([]);
  const { sorted: sortedVisits, sortKey, sortDir, requestSort } = useSortableData(visits, 'visitDate', 'desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // Quick follow-up task creation
  const [taskVisit, setTaskVisit] = useState<Visit | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskSaving, setTaskSaving] = useState(false);

  const createFollowUpTask = async () => {
    if (!taskVisit || !taskTitle.trim()) return;
    setTaskSaving(true);
    try {
      await api.post('/tasks', {
        title: taskTitle.trim(),
        dueDate: taskDue ? new Date(taskDue).toISOString() : null,
        assignedToUserId: auth.user?.id,
        relatedMemberId: taskVisit.memberId ?? null,
        relatedVisitId: taskVisit.id,
      });
      setTaskVisit(null);
      setTaskTitle('');
      setTaskDue('');
    } finally {
      setTaskSaving(false);
    }
  };
  const [formData, setFormData] = useState<CreateVisitData>({
    visitType: 'HomeVisit',
    targetType: isServant ? 'Member' : 'Family',
    visitorType: 'Priest',
    visitDate: new Date().toISOString().split('T')[0],
    followUpRequired: false
  });

  const [filters, setFilters] = useState({
    visitType: '',
    targetType: '',
    visitorType: '',
    fromDate: '',
    toDate: ''
  });

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.visitType) params.append('visitType', filters.visitType);
      if (filters.targetType) params.append('targetType', filters.targetType);
      if (filters.visitorType) params.append('visitorType', filters.visitorType);
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);

      const response = await api.get(`/visits?${params.toString()}`);
      setVisits(response.data.items || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch visits');
    } finally {
      setLoading(false);
    }
  };

  const fetchFamilies = async () => {
    try {
      const response = await api.get('/families?pageSize=1000');
      setFamilies(response.data.items || []);
    } catch (err) {
      console.error('Failed to fetch families', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await api.get('/visits/available-members');
      setMembers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch members', err);
    }
  };

  useEffect(() => {
    fetchVisits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.visitType, filters.targetType, filters.visitorType, filters.fromDate, filters.toDate]);

  useEffect(() => {
    if (openDialog) {
      fetchFamilies();
      fetchMembers();
    }
  }, [openDialog]);

  const handleCreateVisit = async () => {
    try {
      if (formData.targetType === 'Family' && !formData.familyId) {
        alert('Please select a family');
        return;
      }
      if (formData.targetType === 'Member' && !formData.memberId) {
        alert('Please select a member');
        return;
      }

      await api.post('/visits', formData);
      setOpenDialog(false);
      setFormData({
        visitType: 'HomeVisit',
        targetType: 'Family',
        visitorType: 'Priest',
        visitDate: new Date().toISOString().split('T')[0],
        followUpRequired: false
      });
      fetchVisits();
    } catch (err: any) {
      alert(err.response?.data || 'Failed to create visit');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="app">
      <Header />
      <main>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1>{t('visits.title')}</h1>
            <button onClick={() => setOpenDialog(true)} style={{ padding: '10px 20px' }}>
              📝 {t('visits.record')}
            </button>
          </div>

          {error && (
            <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#ffebee', border: '1px solid #f44336', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          {/* Filters */}
          <div style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3>{t('visits.filters')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <label>{t('visits.visitType')}</label>
                <select value={filters.visitType} onChange={(e) => setFilters({ ...filters, visitType: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                  <option value="">{t('visits.all')}</option>
                  <option value="HomeVisit">{t('visits.home')}</option>
                  <option value="PhoneCall">{t('visits.phone')}</option>
                  <option value="WhatsApp">{t('visits.whatsapp')}</option>
                  <option value="Message">{t('visits.message')}</option>
                  <option value="InPerson">{t('visits.inPerson')}</option>
                </select>
              </div>
              <div>
                <label>{t('visits.targetType')}</label>
                <select value={filters.targetType} onChange={(e) => setFilters({ ...filters, targetType: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                  <option value="">{t('visits.all')}</option>
                  <option value="Family">{t('visits.family')}</option>
                  <option value="Member">{t('visits.member')}</option>
                </select>
              </div>
              <div>
                <label>{t('visits.visitorType')}</label>
                <select value={filters.visitorType} onChange={(e) => setFilters({ ...filters, visitorType: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                  <option value="">{t('visits.all')}</option>
                  <option value="Priest">{t('visits.priest')}</option>
                  <option value="Servant">{t('visits.servant')}</option>
                </select>
              </div>
              <div>
                <label>{t('visits.from')}</label>
                <input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} style={{ width: '100%', padding: '8px' }} />
              </div>
              <div>
                <label>{t('visits.to')}</label>
                <input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} style={{ width: '100%', padding: '8px' }} />
              </div>
            </div>
          </div>

          {/* Visits Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <SortTh label={t('visits.type')} field="visitType" current={sortKey} dir={sortDir} onSort={requestSort} style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }} />
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>{t('visits.target')}</th>
                  <SortTh label={t('visits.visitor')} field="visitorName" current={sortKey} dir={sortDir} onSort={requestSort} style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }} />
                  <SortTh label={t('visits.date')} field="visitDate" current={sortKey} dir={sortDir} onSort={requestSort} style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }} />
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>{t('visits.purpose')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>{t('visits.outcome')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>{t('visits.followUp')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '20px', textAlign: 'center' }}>{t('common.loading')}</td>
                  </tr>
                ) : sortedVisits.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '20px', textAlign: 'center' }}>{t('visits.noVisits')}</td>
                  </tr>
                ) : (
                  sortedVisits.map((visit) => (
                    <tr key={visit.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px' }}>
                        {visit.visitType === 'HomeVisit' ? `🏠 ${t('visits.home')}`
                          : visit.visitType === 'PhoneCall' ? `📞 ${t('visits.phone')}`
                          : visit.visitType === 'WhatsApp' ? `💬 ${t('visits.whatsapp')}`
                          : visit.visitType === 'Message' ? `✉️ ${t('visits.message')}`
                          : visit.visitType === 'InPerson' ? `🤝 ${t('visits.inPerson')}`
                          : visit.visitType}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <strong>{visit.targetType === 'Family' ? visit.familyName : visit.memberName}</strong>
                        <br />
                        <small style={{ color: '#666' }}>{visit.targetType}</small>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {visit.visitorName}
                        <br />
                        <small style={{ color: '#666' }}>{visit.visitorType}</small>
                      </td>
                      <td style={{ padding: '12px' }}>{formatDate(visit.visitDate)}</td>
                      <td style={{ padding: '12px' }}>{visit.purpose || '-'}</td>
                      <td style={{ padding: '12px' }}>{visit.outcome || '-'}</td>
                      <td style={{ padding: '12px' }}>
                        {visit.followUpRequired ? (
                          <span style={{ padding: '4px 8px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '12px' }}>
                            ⚠️ {t('visits.required')}
                          </span>
                        ) : (
                          <span style={{ padding: '4px 8px', backgroundColor: '#e8f5e9', borderRadius: '4px', fontSize: '12px' }}>
                            ✓ {t('common.no')}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => {
                            setTaskVisit(visit);
                            setTaskTitle(`متابعة: ${visit.memberName || visit.familyName || ''}`);
                            setTaskDue(visit.nextActionDate ? visit.nextActionDate.substring(0,10) : '');
                          }}
                          style={{
                            background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe',
                            borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem', whiteSpace: 'nowrap',
                          }}
                          title="إنشاء مهمة متابعة"
                        >
                          ✅ مهمة
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Create Visit Dialog */}
          {openDialog && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}>
              <div style={{
                backgroundColor: 'white', padding: '30px', borderRadius: '8px',
                maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto'
              }}>
                <h2>{t('visits.record')}</h2>
                <div style={{ display: 'grid', gap: '15px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label>{t('visits.visitType')}</label>
                      <select
                        value={formData.visitType}
                        onChange={(e) => setFormData({ ...formData, visitType: e.target.value })}
                        style={{ width: '100%', padding: '8px' }}
                      >
                        <option value="HomeVisit">{t('visits.home')}</option>
                        <option value="PhoneCall">{t('visits.phone')}</option>
                        <option value="WhatsApp">{t('visits.whatsapp')}</option>
                        <option value="Message">{t('visits.message')}</option>
                        <option value="InPerson">{t('visits.inPerson')}</option>
                      </select>
                    </div>
                    <div>
                      <label>{t('visits.targetType')}</label>
                      <select
                        value={formData.targetType}
                        onChange={(e) => setFormData({ ...formData, targetType: e.target.value, familyId: undefined, memberId: undefined })}
                        style={{ width: '100%', padding: '8px' }}
                      >
                        {!isServant && <option value="Family">{t('visits.family')}</option>}
                        <option value="Member">{t('visits.member')}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label>{t('visits.visitorType')}</label>
                    <select
                      value={formData.visitorType}
                      onChange={(e) => setFormData({ ...formData, visitorType: e.target.value })}
                      style={{ width: '100%', padding: '8px' }}
                    >
                      <option value="Priest">{t('visits.priest')}</option>
                      <option value="Servant">{t('visits.servant')}</option>
                    </select>
                  </div>

                  {formData.targetType === 'Family' && (
                    <div>
                      <label>{t('visits.family')} *</label>
                      <select
                        value={formData.familyId || ''}
                        onChange={(e) => setFormData({ ...formData, familyId: e.target.value })}
                        style={{ width: '100%', padding: '8px' }}
                      >
                        <option value="">-- {t('visits.family')} --</option>
                        {families.map((family) => (
                          <option key={family.id} value={family.id}>{family.familyName}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.targetType === 'Member' && (
                    <div>
                      <label>{t('visits.member')} *</label>
                      <select
                        value={formData.memberId || ''}
                        onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                        style={{ width: '100%', padding: '8px' }}
                      >
                        <option value="">-- {t('visits.member')} --</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>{member.fullName}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label>{t('visits.date')}</label>
                    <input
                      type="date"
                      value={formData.visitDate}
                      onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>

                  <div>
                    <label>{t('visits.purpose')}</label>
                    <textarea
                      value={formData.purpose || ''}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      rows={2}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>

                  <div>
                    <label>{t('visits.outcome')}</label>
                    <textarea
                      value={formData.outcome || ''}
                      onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                      rows={2}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>

                  <div>
                    <label>{t('visits.form.notes')}</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>

                  <div>
                    <label>{t('visits.form.nextAction')}</label>
                    <input
                      type="date"
                      value={formData.nextActionDate || ''}
                      onChange={(e) => setFormData({ ...formData, nextActionDate: e.target.value })}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>

                  <div>
                    <label>{t('visits.followUp')}</label>
                    <select
                      value={formData.followUpRequired ? 'true' : 'false'}
                      onChange={(e) => setFormData({ ...formData, followUpRequired: e.target.value === 'true' })}
                      style={{ width: '100%', padding: '8px' }}
                    >
                      <option value="false">{t('common.no')}</option>
                      <option value="true">{t('common.yes')}</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setOpenDialog(false)} style={{ padding: '10px 20px' }}>
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleCreateVisit} style={{ padding: '10px 20px', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    {t('common.create')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick follow-up task modal */}
        {taskVisit && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: '90%', maxWidth: 420 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>إنشاء مهمة متابعة</h2>
                <button onClick={() => setTaskVisit(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>×</button>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
                مرتبطة بزيارة: <strong>{taskVisit.memberName || taskVisit.familyName}</strong> — {new Date(taskVisit.visitDate).toLocaleDateString('ar-EG')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  عنوان المهمة *
                  <input
                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.45rem 0.7rem', fontSize: '0.9rem', outline: 'none' }}
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                  />
                </label>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  تاريخ الاستحقاق
                  <input
                    type="date"
                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.45rem 0.7rem', fontSize: '0.9rem', outline: 'none' }}
                    value={taskDue}
                    onChange={e => setTaskDue(e.target.value)}
                  />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                  <button onClick={() => setTaskVisit(null)} style={{ padding: '0.4rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: '0.85rem' }}>
                    إلغاء
                  </button>
                  <button onClick={createFollowUpTask} disabled={taskSaving || !taskTitle.trim()} style={{ padding: '0.4rem 1.2rem', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                    {taskSaving ? 'جاري الحفظ…' : 'إنشاء'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
