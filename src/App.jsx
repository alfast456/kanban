import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './App.css';

function App() {
  const [boards, setBoards] = useState([]);
  const [tasks, setTasks] = useState({}); // Kita simpan tasks per board_id
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // Efek untuk mengubah tema
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Fungsi Fetch Data dari Backend Node.js
  useEffect(() => {
    const fetchData = async () => {
      try {
        const boardsRes = await fetch('/api/boards');
        const boardsData = await boardsRes.json();
        
        const tasksRes = await fetch('/api/tasks');
        const tasksData = await tasksRes.json();

        // Mengelompokkan tasks berdasarkan board_id agar mudah di-render
        const groupedTasks = {};
        boardsData.forEach(b => {
          groupedTasks[b.id] = tasksData.filter(t => t.board_id === b.id);
        });

        setBoards(boardsData);
        setTasks(groupedTasks);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [newTaskContent, setNewTaskContent] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Low");

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  const [viewingTask, setViewingTask] = useState(null);

  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Fungsi untuk Menambah/Edit Tugas
  const openAddModal = (boardId) => {
    setCurrentBoardId(boardId);
    setEditingTaskId(null);
    setNewTaskContent("");
    setNewTaskDescription("");
    setNewTaskPriority("Low");
    setIsModalOpen(true);
  };

  // Fungsi untuk Edit Tugas
  const openEditModal = (task, boardId) => {
    setCurrentBoardId(boardId);
    setEditingTaskId(task.id);
    setNewTaskContent(task.content);
    setNewTaskDescription(task.description || "");
    setNewTaskPriority(task.priority || "Low");
    setIsModalOpen(true);
  };

  const submitNewTask = async (e) => {
    e.preventDefault();
    if (!newTaskContent.trim()) return;

    const boardId = currentBoardId;
    const content = newTaskContent;
    const description = newTaskDescription;
    const priority = newTaskPriority;
    
    setIsModalOpen(false);

    try {
      if (editingTaskId) {
        // Edit Mode
        const res = await fetch(`/api/tasks/${editingTaskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ board_id: boardId, content, description, priority })
        });
        if (!res.ok) throw new Error('Gagal menyimpan tugas ke database');
        const updatedTask = await res.json();

        setTasks(prev => ({
          ...prev,
          [boardId]: prev[boardId].map(t => t.id === editingTaskId ? updatedTask : t)
        }));
        setToast({ type: 'success', message: 'Tugas berhasil diperbarui.' });
      } else {
        // Add Mode
        const position = tasks[boardId] ? tasks[boardId].length : 0;
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ board_id: boardId, content, description, position, priority })
        });
        if (!res.ok) {
          throw new Error('Gagal menyimpan tugas ke database');
        }

        const newTask = await res.json();

        setTasks(prev => ({
          ...prev,
          [boardId]: [...(prev[boardId] || []), newTask]
        }));
        setToast({ type: 'success', message: 'Tugas berhasil disimpan.' });
      }
    } catch (err) {
      console.error("Gagal menyimpan tugas:", err);
      setToast({ type: 'error', message: 'Gagal menyimpan tugas. Silakan coba lagi.' });
    }
  };

  // Konfirmasi sebelum menghapus
  const confirmDeleteTask = (taskId, boardId) => {
    setTaskToDelete({ taskId, boardId });
    setIsConfirmOpen(true);
  };

  // Fungsi untuk Eksekusi Menghapus Tugas
  const executeDeleteTask = async () => {
    if (!taskToDelete) return;
    const { taskId, boardId } = taskToDelete;
    setIsConfirmOpen(false);

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });

      setTasks(prev => ({
        ...prev,
        [boardId]: prev[boardId].filter(t => t.id !== taskId)
      }));
    } catch (err) {
      console.error("Gagal menghapus tugas:", err);
    }
  };

  // Fungsi saat kartu selesai di-drag dan di-drop
  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    // Jika dijatuhkan di luar area droppable, abaikan
    if (!destination) return;

    // Jika dijatuhkan di posisi yang sama persis, abaikan
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return;

    const sourceBoardId = Number(source.droppableId);
    const destBoardId = Number(destination.droppableId);
    
    // Copy state saat ini agar kita tidak mengubah array asli secara langsung
    const newTasks = { ...tasks };
    const sourceList = Array.from(newTasks[sourceBoardId] || []);
    const destList = sourceBoardId === destBoardId ? sourceList : Array.from(newTasks[destBoardId] || []);

    // Hapus kartu dari list asal
    const [movedTask] = sourceList.splice(source.index, 1);
    
    // Ubah board_id kartu jika pindah kolom
    movedTask.board_id = destBoardId;
    
    // Masukkan kartu ke list tujuan
    destList.splice(destination.index, 0, movedTask);

    // Update state React (UI akan langsung ter-update)
    newTasks[sourceBoardId] = sourceList;
    if (sourceBoardId !== destBoardId) {
      newTasks[destBoardId] = destList;
    }
    setTasks(newTasks);

    // Kirim request PUT ke backend Node.js untuk menyimpan perubahan secara permanen
    try {
      await fetch(`/api/tasks/${draggableId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          board_id: destBoardId,
          position: destination.index
        })
      });
    } catch (err) {
      console.error("Gagal update task di backend:", err);
    }
  };

  if (loading) return <div>Memuat Papan Kanban...</div>;

  return (
    <div className="app-container">
      <div className="header">
        <h1>My Personal Kanban</h1>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </button>
      </div>
      
      {/* Bungkus seluruh papan dengan DragDropContext */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board-container">
          
          {boards.map((board) => (
            // Bikin area Droppable untuk setiap kolom board
            <Droppable key={board.id} droppableId={String(board.id)}>
              {(provided, snapshot) => (
                <div
                  className={`board-column ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <h2>{board.title}</h2>
                  
                  <div className="task-list">
                    {tasks[board.id]?.map((task, index) => (
                      // Bikin setiap tugas jadi Draggable
                      <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            className={`task-card ${snapshot.isDragging ? 'is-dragging' : ''}`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <div 
                              className="task-content" 
                              onClick={() => setViewingTask(task)}
                              style={{ cursor: 'pointer' }}
                            >
                              <span className={`task-priority priority-${task.priority?.toLowerCase() || 'low'}`}>
                                {task.priority || 'Low'}
                              </span>
                              <span className="task-title">{task.content}</span>
                              {task.description && (
                                <span className="task-desc">{task.description}</span>
                              )}
                            </div>
                            <div className="task-actions">
                              <button 
                                className="edit-btn" 
                                onClick={() => openEditModal(task, board.id)}
                                title="Edit tugas"
                              >
                                ✎
                              </button>
                              <button 
                                className="delete-btn" 
                                onClick={() => confirmDeleteTask(task.id, board.id)}
                                title="Hapus tugas"
                              >
                                &times;
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {/* Placeholder WAJIB ada di dalam Droppable */}
                    {provided.placeholder}
                  </div>
                  
                  <button className="add-task-btn" onClick={() => openAddModal(board.id)}>
                    Tambah Tugas
                  </button>
                </div>
              )}
            </Droppable>
          ))}

        </div>
      </DragDropContext>

      {/* Modal Lihat Detail Tugas */}
      {viewingTask && (
        <div className="modal-overlay" onClick={() => setViewingTask(null)}>
          <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
            <div className="view-modal-header">
              <span className={`task-priority priority-${viewingTask.priority?.toLowerCase() || 'low'}`}>
                {viewingTask.priority || 'Low'}
              </span>
              <button className="close-btn" onClick={() => setViewingTask(null)}>&times;</button>
            </div>
            <h2 className="view-task-title">{viewingTask.content}</h2>
            {viewingTask.description ? (
              <div className="view-task-desc">
                {viewingTask.description.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="no-desc">Tidak ada deskripsi tambahan.</p>
            )}
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="edit-btn-large" onClick={() => {
                const bId = viewingTask.board_id;
                const task = viewingTask;
                setViewingTask(null);
                openEditModal(task, bId);
              }}>
                ✎ Edit Tugas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Custom */}
      {isConfirmOpen && (
        <div className="modal-overlay" onClick={() => setIsConfirmOpen(false)}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <h3>Hapus Tugas?</h3>
            <p>Apakah Anda yakin ingin menghapus tugas ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setIsConfirmOpen(false)}>Batal</button>
              <button className="delete-confirm-btn" onClick={executeDeleteTask}>Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Modal Tambah/Edit Tugas Custom (Glassmorphism) */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editingTaskId ? "✨ Edit Tugas" : "✨ Buat Tugas Baru"}</h3>
            <form onSubmit={submitNewTask}>
              <div className="form-group">
                <label>Judul Tugas</label>
                <input 
                  type="text" 
                  autoFocus 
                  value={newTaskContent} 
                  onChange={e => setNewTaskContent(e.target.value)} 
                  placeholder="Misal: Memperbaiki bug pada halaman login..." 
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label>Deskripsi Tambahan (Opsional)</label>
                <textarea 
                  value={newTaskDescription} 
                  onChange={e => setNewTaskDescription(e.target.value)} 
                  placeholder="Ketik detail tugas di sini..." 
                  rows="3"
                ></textarea>
              </div>
              <div className="form-group">
                <label>Tingkat Prioritas</label>
                <div className="priority-selectors">
                  {['Low', 'Medium', 'High'].map(p => (
                    <button 
                      type="button" 
                      key={p}
                      className={`priority-select-btn ${newTaskPriority === p ? 'active' : ''} priority-${p.toLowerCase()}`}
                      onClick={() => setNewTaskPriority(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Batal</button>
                <button type="submit" className="save-btn" disabled={!newTaskContent.trim()}>Simpan Tugas</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;