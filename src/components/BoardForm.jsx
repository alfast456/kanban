export function BoardForm({ title, onChange, onSubmit, onCancel, isEditing }) {
  return (
    <>
      <h3>{isEditing ? '✎ Ubah Nama Kolom' : '+ Tambah Kolom'}</h3>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="board-title">Nama Kolom</label>
          <input
            id="board-title"
            autoFocus
            value={title}
            onChange={event => onChange(event.target.value)}
            placeholder="Misal: Dalam Proses"
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Batal</button>
          <button type="submit" className="save-btn" disabled={!title.trim()}>Simpan Kolom</button>
        </div>
      </form>
    </>
  );
}
