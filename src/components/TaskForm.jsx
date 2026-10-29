import { PRIORITIES } from '../utils/taskUtils.mjs';

export function TaskForm({ form, onChange, onSubmit, onCancel, isEditing }) {
  return (
    <>
      <div className="modal-header">
        <h3>{isEditing ? 'Edit Tugas' : 'Buat Tugas Baru'}</h3>
      </div>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="task-content">Judul Tugas</label>
          <input
            id="task-content"
            autoFocus
            value={form.content}
            onChange={event => onChange({ content: event.target.value })}
            placeholder="Misal: Memperbaiki bug pada halaman login..."
          />
        </div>
        <div className="form-group">
          <label htmlFor="task-description">Deskripsi Tambahan (Opsional)</label>
          <textarea
            id="task-description"
            value={form.description}
            onChange={event => onChange({ description: event.target.value })}
            placeholder="Ketik detail tugas di sini..."
            rows="3"
          />
        </div>
        <div className="form-group">
          <label htmlFor="task-due-date">Tanggal Tenggat (Opsional)</label>
          <input
            id="task-due-date"
            type="date"
            value={form.due_date}
            onChange={event => onChange({ due_date: event.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Tingkat Prioritas</label>
          <div className="priority-selectors" role="group" aria-label="Tingkat Prioritas">
            {PRIORITIES.map(priority => {
              const pKey = priority.toLowerCase();
              return (
                <button
                  type="button"
                  key={priority}
                  className={`priority-select-btn ${form.priority === priority ? 'active' : ''} priority-btn-${pKey}`}
                  onClick={() => onChange({ priority })}
                >
                  <span className={`priority-indicator-dot priority-${pKey}`} aria-hidden="true" />
                  {priority}
                </button>
              );
            })}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Batal</button>
          <button type="submit" className="save-btn" disabled={!form.content.trim()}>Simpan Tugas</button>
        </div>
      </form>
    </>
  );
}
