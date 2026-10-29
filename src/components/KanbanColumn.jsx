import { Droppable } from '@hello-pangea/dnd';
import { TaskCard } from './TaskCard';
import { IconEdit, IconShare, IconTrash, IconPlus } from './Icons';

export function KanbanColumn({
  board,
  boardTasks,
  visibleTasks,
  onOpenAddTask,
  onOpenEditBoard,
  onRequestDeleteBoard,
  onOpenShareBoard,
  onOpenViewTask,
  onOpenEditTask,
  onRequestDeleteTask,
  canEdit = true,
}) {
  return (
    <Droppable droppableId={String(board.id)}>
      {(provided, snapshot) => (
        <section
          className={`board-column ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          <div className="board-header">
            <h2>
              <span className="board-title-text">{board.title}</span>
              <span className="board-count" title={`${visibleTasks.length} ditampilkan dari ${boardTasks.length} tugas`}>
                {visibleTasks.length}/{boardTasks.length}
              </span>
            </h2>
            <div className="board-actions">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onOpenEditBoard(board)}
                  aria-label={`Edit board ${board.title}`}
                  title="Ubah nama kolom"
                >
                  <IconEdit size={13} />
                </button>
              )}
              {board.access_role === 'owner' && (
                <button
                  type="button"
                  onClick={() => onOpenShareBoard(board)}
                  aria-label={`Bagikan board ${board.title}`}
                  title="Bagikan board"
                >
                  <IconShare size={13} />
                </button>
              )}
              {board.access_role === 'owner' && (
                <button
                  type="button"
                  onClick={() => onRequestDeleteBoard(board)}
                  aria-label={`Hapus board ${board.title}`}
                  title="Hapus kolom"
                >
                  <IconTrash size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="task-list">
            {visibleTasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onOpenView={onOpenViewTask}
                onOpenEdit={taskItem => onOpenEditTask(taskItem, board.id)}
                onRequestDelete={taskItem => onRequestDeleteTask({ id: taskItem.id, boardId: board.id })}
                canEdit={canEdit}
              />
            ))}
            {provided.placeholder}

            {visibleTasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="column-empty-state">
                <span>Belum ada tugas</span>
              </div>
            )}
          </div>

          {canEdit && (
            <button
              type="button"
              className="add-task-btn"
              onClick={() => onOpenAddTask(board.id)}
            >
              <IconPlus size={15} />
              <span>Tambah Tugas</span>
            </button>
          )}
        </section>
      )}
    </Droppable>
  );
}
