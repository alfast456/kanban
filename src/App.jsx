import { useCallback, useEffect, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { PRIORITIES, dueStatus, formatDueDate } from './utils/taskUtils.mjs';
import { Modal, ConfirmModal } from './components/Modal';
import { KanbanColumn } from './components/KanbanColumn';
import { TaskForm } from './components/TaskForm';
import { BoardForm } from './components/BoardForm';
import { AuthForm } from './components/AuthForm';
import './App.css';

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
  const [sharingBoard, setSharingBoard] = useState(null);
  const [shareUsername, setShareUsername] = useState('');
  const [shareRole, setShareRole] = useState('viewer');
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [authUser, setAuthUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('authUser')) || null; } catch { return null; }
  });
  const [authModal, setAuthModal] = useState(null);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const apiFetch = useCallback((url, options = {}) => fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  }), [authToken]);

  const loadData = useCallback(async (isInitial = false) => {
    try {
      const [boardsRes, tasksRes] = await Promise.all([apiFetch('/api/boards'), apiFetch('/api/tasks')]);
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
  }, [apiFetch]);

  useEffect(() => {
    const authResult = new URLSearchParams(window.location.search).get('auth');
    if (authResult === 'success') {
      fetch('/api/auth/me')
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(({ user }) => {
          setAuthUser(user);
          localStorage.setItem('authUser', JSON.stringify(user));
          loadData();
          notify('success', 'Berhasil masuk dengan Google.');
        })
        .catch(() => notify('error', 'Login Google gagal.'))
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
    } else if (authResult === 'error') {
      notify('error', 'Login Google gagal.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadData]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    const eventSource = new EventSource(authToken ? `/api/events?token=${encodeURIComponent(authToken)}` : '/api/events');

    eventSource.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type && payload.type !== 'connected') {
          loadData();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE connection lost, reconnecting...');
    };

    return () => eventSource.close();
  }, [authToken, loadData]);

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
      const res = await apiFetch(isEditing ? `/api/tasks/${task.id}` : '/api/tasks', {
        method: isEditing ? 'PUT' : 'POST',
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
      const res = await apiFetch(`/api/tasks/${taskToDelete.id}`, { method: 'DELETE' });
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

  const shareBoard = async event => {
    event.preventDefault();
    if (!sharingBoard || !shareUsername.trim()) return;
    try {
      const res = await apiFetch(`/api/boards/${sharingBoard.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ username: shareUsername.trim(), role: shareRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membagikan board');
      setSharingBoard(null);
      setShareUsername('');
      notify('success', 'Board berhasil dibagikan.');
    } catch (err) {
      notify('error', err.message);
    }
  };

  const submitBoard = async event => {
    event.preventDefault();
    if (!boardTitle.trim() || !boardModal) return;
    const board = boardModal.board;
    try {
      const res = await apiFetch(board ? `/api/boards/${board.id}` : '/api/boards', {
        method: board ? 'PUT' : 'POST',
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
      const res = await apiFetch(`/api/boards/${boardToDelete.id}`, { method: 'DELETE' });
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
    const sourceBoard = boards.find(board => board.id === Number(source.droppableId));
    if (sourceBoard?.access_role === 'viewer') return notify('error', 'Akses viewer hanya dapat membaca.');

    const sourceBoardId = Number(source.droppableId);
    const destBoardId = Number(destination.droppableId);
    const destinationBoard = boards.find(board => board.id === destBoardId);
    if (destinationBoard?.access_role === 'viewer') return notify('error', 'Board tujuan hanya dapat dibaca.');
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
      const res = await apiFetch(`/api/tasks/${draggableId}`, {
        method: 'PUT',
        body: JSON.stringify({ board_id: destBoardId, position: destination.index }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan perpindahan tugas');
    } catch (err) {
      console.error('Gagal update task di backend:', err);
      setTasks(tasks);
      notify('error', 'Gagal memindahkan tugas.');
    }
  };

  const handleAuthSubmit = async event => {
    event.preventDefault();
    setAuthError('');
    const formData = new FormData(event.currentTarget);
    const username = formData.get('username');
    const password = formData.get('password');

    try {
      const endpoint = authModal === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal autentikasi');

      localStorage.setItem('authToken', data.token);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      setAuthToken(data.token);
      setAuthUser(data.user);
      setLoading(true);
      setAuthModal(null);
      notify('success', authModal === 'register' ? 'Akun berhasil dibuat.' : 'Berhasil masuk.');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setAuthToken(null);
    setAuthUser(null);
    notify('success', 'Berhasil keluar.');
  };

  if (loading) return <div>Memuat Papan Kanban...</div>;

  return (
    <div className="app-container">
      <header className="header">
        <h1>My Personal Kanban</h1>
        <div className="header-actions">
          {authUser ? (
            <div className="user-badge">
              <span className="user-name">@{authUser.username}</span>
              <button className="auth-btn" onClick={handleLogout}>Keluar</button>
            </div>
          ) : (
            <button className="auth-btn" onClick={() => { setAuthError(''); setAuthModal('login'); }}>Masuk</button>
          )}
          <button className="theme-toggle" onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
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
          {PRIORITIES.map(priority => (
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
              <KanbanColumn
                key={board.id}
                board={board}
                boardTasks={boardTasks}
                visibleTasks={visibleTasks}
                onOpenAddTask={openAddTask}
                onOpenEditBoard={openEditBoard}
                onRequestDeleteBoard={setBoardToDelete}
                onOpenShareBoard={setSharingBoard}
                onOpenViewTask={setViewingTask}
                onOpenEditTask={openEditTask}
                onRequestDeleteTask={setTaskToDelete}
                canEdit={board.access_role !== 'viewer'}
              />
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

      {authModal && (
        <Modal onClose={() => setAuthModal(null)}>
          <AuthForm
            mode={authModal}
            onModeChange={mode => { setAuthError(''); setAuthModal(mode); }}
            onSubmit={handleAuthSubmit}
            onGoogleLogin={() => { window.location.href = '/api/auth/google'; }}
            onCancel={() => setAuthModal(null)}
            error={authError}
          />
        </Modal>
      )}

      {sharingBoard && (
        <Modal onClose={() => setSharingBoard(null)}>
          <h3>Bagikan Board</h3>
          <form onSubmit={shareBoard}>
            <div className="form-group">
              <label htmlFor="share-username">Username</label>
              <input id="share-username" value={shareUsername} onChange={event => setShareUsername(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="share-role">Akses</label>
              <select id="share-role" value={shareRole} onChange={event => setShareRole(event.target.value)}>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>
            <div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setSharingBoard(null)}>Batal</button><button className="save-btn">Bagikan</button></div>
          </form>
        </Modal>
      )}

      {taskModal && (
        <Modal onClose={() => setTaskModal(null)}>
          <TaskForm
            form={taskForm}
            isEditing={Boolean(taskModal.task)}
            onChange={changes => setTaskForm(form => ({ ...form, ...changes }))}
            onSubmit={submitTask}
            onCancel={() => setTaskModal(null)}
          />
        </Modal>
      )}

      {boardModal && (
        <Modal onClose={() => setBoardModal(null)}>
          <BoardForm
            title={boardTitle}
            isEditing={Boolean(boardModal.board)}
            onChange={setBoardTitle}
            onSubmit={submitBoard}
            onCancel={() => setBoardModal(null)}
          />
        </Modal>
      )}

      {taskToDelete && <ConfirmModal title="Hapus Tugas?" text="Apakah Anda yakin ingin menghapus tugas ini? Tindakan ini tidak dapat dibatalkan." onCancel={() => setTaskToDelete(null)} onConfirm={deleteTask} />}
      {boardToDelete && <ConfirmModal title="Hapus Kolom?" text="Semua tugas di dalam kolom ini juga akan dihapus. Tindakan ini tidak dapat dibatalkan." onCancel={() => setBoardToDelete(null)} onConfirm={deleteBoard} />}
      {toast && <div className={`toast-notification toast-${toast.type}`}>{toast.message}</div>}
    </div>
  );
}

export default App;
