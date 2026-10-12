import { useCallback, useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './App.css';

const priorities = ['Low', 'Medium', 'High'];

function dueStatus(dueDate) {
  if (!dueDate) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return 'overdue';
  if (days <= 2) return 'soon';
  return 'upcoming';
}

function formatDueDate(dueDate) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${dueDate.slice(0, 10)}T00:00:00`));
}

function App() {
  const [boards, setBoards] = useState([]);
  const [tasks, setTasks] = useState({});
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [viewingTask, setViewingTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [boardToDelete, setBoardToDelete] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [boardModal, setBoardModal] = useState(null);
  const [boardTitle, setBoardTitle] = useState('');
  const [taskForm, setTaskForm] = useState({ content: '', description: '', priority: 'Low', due_date: '' });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const loadData = useCallback(async (isInitial = false) => {
    try {
      const [boardsRes, tasksRes] = await Promise.all([fetch('/api/boards'), fetch('/api/tasks')]);
      if (!boardsRes.ok || !tasksRes.ok) throw new Error('Gagal mengambil data');
      const [boardsData, tasksData] = await Promise.all([boardsRes.json(), tasksRes.json()]);
      setBoards(boardsData);
      setTasks(Object.fromEntries(boardsData.map(board => [
        board.id,
        tasksData.filter(task => task.board_id === board.id),
      ])));
    } catch (err) {
      console.error('Error fetching data:', err);
      if (isInitial) setToast({ type: 'error', message: 'Gagal memuat data Kanban.' });
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'kanban:changed') {
          loadData();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    return () => eventSource.close();
  }, [loadData]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (type, message) => setToast({ type, message });
  const isVisibleTask = task =>
    task.content.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
    (!filterPriority || task.priority === filterPriority);

  const openAddTask = boardId => {
    setTaskModal({ boardId, task: null });
    setTaskForm({ content: '', description: '', priority: 'Low', due_date: '' });
  };

  const openEditTask = (task, boardId) => {
    setTaskModal({ boardId, task });
    setTaskForm({
      content: task.content,
      description: task.description || '',
      priority: task.priority || 'Low',
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
    });
  };

  const submitTask = async event => {
    event.preventDefault();
    if (!taskForm.content.trim() || !taskModal) return;

    const { boardId, task } = taskModal;
    const isEditing = Boolean(task);
    const body = {
      board_id: Number(boardId),
      content: taskForm.content.trim(),
      description: taskForm.description.trim(),
      priority: taskForm.priority,
      due_date: taskForm.due_date || null,
      ...(isEditing ? { clear_due_date: !taskForm.due_date } : { position: (tasks[boardId] || []).length }),
    };

    try {
      const res = await fetch(isEditing ? `/api/tasks/${task.id}` : '/api/tasks', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Gagal menyimpan tugas');
      const savedTask = await res.json();
      setTasks(previous => ({
        ...previous,
        [boardId]: isEditing
          ? previous[boardId].map(item => item.id === savedTask.id ? savedTask : item)
          : [...(previous[boardId] || []), savedTask],
      }));
      setTaskModal(null);
      notify('success', isEditing ? 'Tugas berhasil diperbarui.' : 'Tugas berhasil disimpan.');
    } catch (err) {
      console.error('Gagal menyimpan tugas:', err);
      notify('error', 'Gagal menyimpan tugas. Silakan coba lagi.');
    }
  };

  const deleteTask = async () => {
    if (!taskToDelete) return;
    try {
      const res = await fetch(`/api/tasks/${taskToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus tugas');
      setTasks(previous => ({
        ...previous,
        [taskToDelete.boardId]: previous[taskToDelete.boardId].filter(task => task.id !== taskToDelete.id),
      }));
      setTaskToDelete(null);
      notify('success', 'Tugas berhasil dihapus.');
    } catch (err) {
      console.error('Gagal menghapus tugas:', err);
      notify('error', 'Gagal menghapus tugas.');
    }
  };

  const openAddBoard = () => {
    setBoardModal({ board: null });
    setBoardTitle('');
  };

  const openEditBoard = board => {
    setBoardModal({ board });
    setBoardTitle(board.title);
  };

  const submitBoard = async event => {
    event.preventDefault();
    if (!boardTitle.trim() || !boardModal) return;
    const board = boardModal.board;
    try {
      const res = await fetch(board ? `/api/boards/${board.id}` : '/api/boards', {
        method: board ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(board ? { title: boardTitle } : { title: boardTitle, position: boards.length }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan board');
      const savedBoard = await res.json();
      setBoards(previous => board
        ? previous.map(item => item.id === savedBoard.id ? savedBoard : item)
        : [...previous, savedBoard]);
      if (!board) setTasks(previous => ({ ...previous, [savedBoard.id]: [] }));
      setBoardModal(null);
      notify('success', board ? 'Kolom berhasil diperbarui.' : 'Kolom berhasil ditambahkan.');
    } catch (err) {
      console.error('Gagal menyimpan board:', err);
      notify('error', 'Gagal menyimpan kolom.');
    }
  };

  const deleteBoard = async () => {
    if (!boardToDelete) return;
    try {
      const res = await fetch(`/api/boards/${boardToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus board');
      setBoards(previous => previous.filter(board => board.id !== boardToDelete.id));
      setTasks(previous => {
        const next = { ...previous };
        delete next[boardToDelete.id];
        return next;
      });
      setBoardToDelete(null);
      notify('success', 'Kolom berhasil dihapus.');
    } catch (err) {
      console.error('Gagal menghapus board:', err);
      notify('error', 'Gagal menghapus kolom.');
    }
  };

  const onDragEnd = async result => {
    const { source, destination, draggableId } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return;

    const sourceBoardId = Number(source.droppableId);
    const destBoardId = Number(destination.droppableId);
    const nextTasks = { ...tasks };
    const sourceList = [...(nextTasks[sourceBoardId] || [])];
    const destList = sourceBoardId === destBoardId ? sourceList : [...(nextTasks[destBoardId] || [])];
    const [movedTask] = sourceList.splice(source.index, 1);
    const updatedTask = { ...movedTask, board_id: destBoardId };
    destList.splice(destination.index, 0, updatedTask);
    nextTasks[sourceBoardId] = sourceList;
    nextTasks[destBoardId] = destList;
    setTasks(nextTasks);

    try {
      const res = await fetch(`/api/tasks/${draggableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board_id: destBoardId, position: destination.index }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan perpindahan tugas');
    } catch (err) {
      console.error('Gagal update task di backend:', err);
      setTasks(tasks);
      notify('error', 'Gagal memindahkan tugas.');
    }
  };

  if (loading) return <div>Memuat Papan Kanban...</div>;

  return (
    <div className="app-container">
      <header className="header">
        <h1>My Personal Kanban</h1>
        <button className="theme-toggle" onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </button>
      </header>

      <div className="task-filters">
        <input
          className="task-search"
          type="search"
          value={searchQuery}
          onChange={event => setSearchQuery(event.target.value)}
          placeholder="Cari tugas..."
          aria-label="Cari tugas"
        />
        <div className="filter-priorities" aria-label="Filter prioritas">
          <button className={!filterPriority ? 'active' : ''} onClick={() => setFilterPriority('')}>Semua</button>
          {priorities.map(priority => (
            <button key={priority} className={filterPriority === priority ? 'active' : ''} onClick={() => setFilterPriority(priority)}>
              {priority}
            </button>
          ))}
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <main className="board-container">
          {boards.map(board => {
            const boardTasks = tasks[board.id] || [];
            const visibleTasks = boardTasks.filter(isVisibleTask);
            return (
              <Droppable key={board.id} droppableId={String(board.id)}>
                {(provided, snapshot) => (
                  <section
                    className={`board-column ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    <div className="board-header">
                      <h2>{board.title} <span>{visibleTasks.length}/{boardTasks.length}</span></h2>
                      <div className="board-actions">
                        <button type="button" onClick={() => openEditBoard(board)} title="Ubah nama kolom">✎</button>
                        <button type="button" onClick={() => setBoardToDelete(board)} title="Hapus kolom">×</button>
                      </div>
                    </div>
                    <div className="task-list">
                      {visibleTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <article
                              className={`task-card ${dragSnapshot.isDragging ? 'is-dragging' : ''}`}
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                            >
                              <div className="task-content" onClick={() => setViewingTask(task)}>
                                <span className={`task-priority priority-${(task.priority || 'Low').toLowerCase()}`}>{task.priority || 'Low'}</span>
                                <span className="task-title">{task.content}</span>
                                {task.description && <span className="task-desc">{task.description}</span>}
                                {task.due_date && <span className={`task-due-date due-${dueStatus(task.due_date)}`}>◷ {formatDueDate(task.due_date)}</span>}
                              </div>
                              <div className="task-actions">
                                <button className="edit-btn" onClick={() => openEditTask(task, board.id)} title="Edit tugas">✎</button>
                                <button className="delete-btn" onClick={() => setTaskToDelete({ id: task.id, boardId: board.id })} title="Hapus tugas">×</button>
                              </div>
                            </article>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                    <button className="add-task-btn" onClick={() => openAddTask(board.id)}>Tambah Tugas</button>
                  </section>
                )}
              </Droppable>
            );
          })}
          <button className="add-board-btn" onClick={openAddBoard}>Tambah Kolom</button>
        </main>
      </DragDropContext>

      {viewingTask && (
        <Modal onClose={() => setViewingTask(null)} className="view-modal">
          <div className="view-modal-header">
            <span className={`task-priority priority-${(viewingTask.priority || 'Low').toLowerCase()}`}>{viewingTask.priority || 'Low'}</span>
            <button className="close-btn" onClick={() => setViewingTask(null)}>×</button>
          </div>
          <h2 className="view-task-title">{viewingTask.content}</h2>
          {viewingTask.due_date && <p className={`task-due-date due-${dueStatus(viewingTask.due_date)}`}>◷ Tenggat: {formatDueDate(viewingTask.due_date)}</p>}
          {viewingTask.description ? <div className="view-task-desc">{viewingTask.description.split('\n').map((line, index) => <p key={index}>{line}</p>)}</div> : <p className="no-desc">Tidak ada deskripsi tambahan.</p>}
          <div className="modal-actions"><button className="edit-btn-large" onClick={() => { setViewingTask(null); openEditTask(viewingTask, viewingTask.board_id); }}>✎ Edit Tugas</button></div>
        </Modal>
      )}

      {taskModal && (
        <Modal onClose={() => setTaskModal(null)}>
          <h3>{taskModal.task ? '✨ Edit Tugas' : '✨ Buat Tugas Baru'}</h3>
          <form onSubmit={submitTask}>
            <div className="form-group"><label>Judul Tugas</label><input autoFocus value={taskForm.content} onChange={event => setTaskForm(form => ({ ...form, content: event.target.value }))} placeholder="Misal: Memperbaiki bug pada halaman login..." /></div>
            <div className="form-group"><label>Deskripsi Tambahan (Opsional)</label><textarea value={taskForm.description} onChange={event => setTaskForm(form => ({ ...form, description: event.target.value }))} placeholder="Ketik detail tugas di sini..." rows="3" /></div>
            <div className="form-group"><label>Tanggal Tenggat (Opsional)</label><input type="date" value={taskForm.due_date} onChange={event => setTaskForm(form => ({ ...form, due_date: event.target.value }))} /></div>
            <div className="priority-form-row">
              <label>Tingkat Prioritas</label>
              <div className="priority-selectors">{priorities.map(priority => <button type="button" key={priority} className={`priority-select-btn ${taskForm.priority === priority ? 'active' : ''} priority-${priority.toLowerCase()}`} onClick={() => setTaskForm(form => ({ ...form, priority }))}>{priority}</button>)}</div>
            </div>
            <div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setTaskModal(null)}>Batal</button><button type="submit" className="save-btn" disabled={!taskForm.content.trim()}>Simpan Tugas</button></div>
          </form>
        </Modal>
      )}

      {boardModal && (
        <Modal onClose={() => setBoardModal(null)}>
          <h3>{boardModal.board ? '✎ Ubah Nama Kolom' : '+ Tambah Kolom'}</h3>
          <form onSubmit={submitBoard}>
            <div className="form-group"><label>Nama Kolom</label><input autoFocus value={boardTitle} onChange={event => setBoardTitle(event.target.value)} placeholder="Misal: Dalam Proses" /></div>
            <div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setBoardModal(null)}>Batal</button><button type="submit" className="save-btn" disabled={!boardTitle.trim()}>Simpan Kolom</button></div>
          </form>
        </Modal>
      )}

      {taskToDelete && <ConfirmModal title="Hapus Tugas?" text="Apakah Anda yakin ingin menghapus tugas ini? Tindakan ini tidak dapat dibatalkan." onCancel={() => setTaskToDelete(null)} onConfirm={deleteTask} />}
      {boardToDelete && <ConfirmModal title="Hapus Kolom?" text="Semua tugas di dalam kolom ini juga akan dihapus. Tindakan ini tidak dapat dibatalkan." onCancel={() => setBoardToDelete(null)} onConfirm={deleteBoard} />}
      {toast && <div className={`toast-notification toast-${toast.type}`}>{toast.message}</div>}
    </div>
  );
}

function Modal({ children, onClose, className = '' }) {
  return <div className="modal-overlay" onClick={onClose}><div className={`modal-content ${className}`} onClick={event => event.stopPropagation()}>{children}</div></div>;
}

function ConfirmModal({ title, text, onCancel, onConfirm }) {
  return <Modal onClose={onCancel} className="confirm-modal"><div className="confirm-icon">⚠️</div><h3>{title}</h3><p>{text}</p><div className="modal-actions"><button className="cancel-btn" onClick={onCancel}>Batal</button><button className="delete-confirm-btn" onClick={onConfirm}>Ya, Hapus</button></div></Modal>;
}

export default App;
