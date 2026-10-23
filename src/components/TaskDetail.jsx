import { useEffect, useState } from 'react';

function formatActivityDate(value) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function TaskDetail({ task, board, apiFetch, canEdit, onClose, onTaskChange }) {
  const [checklist, setChecklist] = useState([]);
  const [labels, setLabels] = useState([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState((task.labels || []).map(label => label.id));
  const [attachments, setAttachments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [newChecklist, setNewChecklist] = useState('');
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#3b82f6');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch(`/api/tasks/${task.id}/checklist`).then(response => response.json()),
      apiFetch(`/api/boards/${board.id}/labels`).then(response => response.json()),
      apiFetch(`/api/tasks/${task.id}/attachments`).then(response => response.json()),
      apiFetch(`/api/tasks/${task.id}/activity`).then(response => response.json()),
    ]).then(([checklistData, labelData, attachmentData, activityData]) => {
      if (!active) return;
      setChecklist(checklistData);
      setLabels(labelData);
      setAttachments(attachmentData);
      setActivity(activityData);
    }).catch(() => {
      if (active) setError('Gagal memuat detail tugas.');
    });
    return () => { active = false; };
  }, [apiFetch, board.id, task.id]);

  const updateChecklistSummary = nextChecklist => {
    setChecklist(nextChecklist);
    onTaskChange({
      ...task,
      checklist_total: nextChecklist.length,
      checklist_done: nextChecklist.filter(item => item.completed).length,
    });
  };

  const addChecklist = async event => {
    event.preventDefault();
    if (!newChecklist.trim()) return;
    const response = await apiFetch(`/api/tasks/${task.id}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ content: newChecklist.trim() }),
    });
    if (!response.ok) return setError('Gagal menambah checklist.');
    updateChecklistSummary([...checklist, await response.json()]);
    setNewChecklist('');
  };

  const toggleChecklist = async item => {
    const response = await apiFetch(`/api/tasks/${task.id}/checklist/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({ completed: !item.completed }),
    });
    if (!response.ok) return setError('Gagal memperbarui checklist.');
    const updated = await response.json();
    updateChecklistSummary(checklist.map(current => current.id === updated.id ? updated : current));
  };

  const deleteChecklist = async item => {
    const response = await apiFetch(`/api/tasks/${task.id}/checklist/${item.id}`, { method: 'DELETE' });
    if (!response.ok) return setError('Gagal menghapus checklist.');
    updateChecklistSummary(checklist.filter(current => current.id !== item.id));
  };

  const toggleLabel = async labelId => {
    const nextIds = selectedLabelIds.includes(labelId)
      ? selectedLabelIds.filter(id => id !== labelId)
      : [...selectedLabelIds, labelId];
    const response = await apiFetch(`/api/tasks/${task.id}/labels`, {
      method: 'PUT',
      body: JSON.stringify({ label_ids: nextIds }),
    });
    if (!response.ok) return setError('Gagal memperbarui label.');
    setSelectedLabelIds(nextIds);
    onTaskChange({ ...task, labels: labels.filter(label => nextIds.includes(label.id)) });
  };

  const createLabel = async event => {
    event.preventDefault();
    if (!labelName.trim()) return;
    const response = await apiFetch(`/api/boards/${board.id}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name: labelName.trim(), color: labelColor }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message || 'Gagal membuat label.');
    setLabels([...labels, data].sort((left, right) => left.name.localeCompare(right.name)));
    setLabelName('');
  };

  const addAttachment = async event => {
    event.preventDefault();
    const response = await apiFetch(`/api/tasks/${task.id}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ name: attachmentName.trim(), url: attachmentUrl.trim() }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message || 'Gagal menambah lampiran.');
    setAttachments([data, ...attachments]);
    setAttachmentName('');
    setAttachmentUrl('');
  };

  const deleteAttachment = async attachment => {
    const response = await apiFetch(`/api/tasks/${task.id}/attachments/${attachment.id}`, { method: 'DELETE' });
    if (!response.ok) return setError('Gagal menghapus lampiran.');
    setAttachments(attachments.filter(item => item.id !== attachment.id));
  };

  return (
    <div className="task-detail">
      <div className="view-modal-header">
        <span className={`task-priority priority-${(task.priority || 'Low').toLowerCase()}`}>{task.priority || 'Low'}</span>
        <button className="close-btn" onClick={onClose} aria-label="Tutup detail tugas">×</button>
      </div>
      <h2 className="view-task-title">{task.content}</h2>
      {task.description ? <p className="task-detail-description">{task.description}</p> : <p className="no-desc">Tidak ada deskripsi tambahan.</p>}
      {error && <p className="task-detail-error" role="alert">{error}</p>}

      <section className="task-detail-section">
        <h3>Checklist <span>{checklist.filter(item => item.completed).length}/{checklist.length}</span></h3>
        {checklist.map(item => (
          <div className="checklist-item" key={item.id}>
            <label>
              <input type="checkbox" checked={item.completed} disabled={!canEdit} onChange={() => toggleChecklist(item)} />
              <span className={item.completed ? 'is-complete' : ''}>{item.content}</span>
            </label>
            {canEdit && <button type="button" className="inline-delete" onClick={() => deleteChecklist(item)} aria-label={`Hapus checklist ${item.content}`}>×</button>}
          </div>
        ))}
        {canEdit && <form className="inline-form" onSubmit={addChecklist}>
          <input aria-label="Checklist baru" value={newChecklist} onChange={event => setNewChecklist(event.target.value)} placeholder="Tambah checklist..." />
          <button className="save-btn" disabled={!newChecklist.trim()}>Tambah</button>
        </form>}
      </section>

      <section className="task-detail-section">
        <h3>Label</h3>
        <div className="label-picker">
          {labels.map(label => (
            <label key={label.id} className="label-option">
              <input type="checkbox" checked={selectedLabelIds.includes(label.id)} disabled={!canEdit} onChange={() => toggleLabel(label.id)} />
              <span className="task-label" style={{ '--label-color': label.color }}>{label.name}</span>
            </label>
          ))}
          {!labels.length && <span className="empty-detail">Belum ada label.</span>}
        </div>
        {canEdit && <form className="inline-form label-create-form" onSubmit={createLabel}>
          <input aria-label="Nama label baru" value={labelName} onChange={event => setLabelName(event.target.value)} placeholder="Nama label" maxLength="40" />
          <input aria-label="Warna label baru" type="color" value={labelColor} onChange={event => setLabelColor(event.target.value)} />
          <button className="save-btn" disabled={!labelName.trim()}>Buat</button>
        </form>}
      </section>

      <section className="task-detail-section">
        <h3>Lampiran</h3>
        {attachments.map(attachment => (
          <div className="attachment-item" key={attachment.id}>
            <a href={attachment.url} target="_blank" rel="noreferrer">↗ {attachment.name}</a>
            {canEdit && <button type="button" className="inline-delete" onClick={() => deleteAttachment(attachment)} aria-label={`Hapus lampiran ${attachment.name}`}>×</button>}
          </div>
        ))}
        {!attachments.length && <span className="empty-detail">Belum ada lampiran.</span>}
        {canEdit && <form className="attachment-form" onSubmit={addAttachment}>
          <input aria-label="Nama lampiran" value={attachmentName} onChange={event => setAttachmentName(event.target.value)} placeholder="Nama lampiran" />
          <input aria-label="URL lampiran" type="url" value={attachmentUrl} onChange={event => setAttachmentUrl(event.target.value)} placeholder="https://..." required />
          <button className="save-btn" disabled={!attachmentName.trim()}>Tambah</button>
        </form>}
      </section>

      <section className="task-detail-section">
        <h3>Aktivitas</h3>
        {activity.map(item => (
          <div className="activity-item" key={item.id}>
            <strong>{item.action}</strong><span>{item.username ? ` oleh @${item.username}` : ''}</span>
            <small>{formatActivityDate(item.created_at)}</small>
            {item.detail && <p>{item.detail}</p>}
          </div>
        ))}
        {!activity.length && <span className="empty-detail">Belum ada aktivitas.</span>}
      </section>
    </div>
  );
}
