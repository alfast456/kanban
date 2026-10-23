import { Droppable } from '@hello-pangea/dnd';
import { TaskCard } from './TaskCard';

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
              {board.title} <span>{visibleTasks.length}/{boardTasks.length}</span>
            </h2>
            <div className="board-actions">
              {canEdit && <button type="button" onClick={() => onOpenEditBoard(board)} title="Ubah nama kolom">✎</button>}
              {board.access_role === 'owner' && <button type="button" onClick={() => onOpenShareBoard(board)} title="Bagikan board">♧</button>}
              {board.access_role === 'owner' && <button type="button" onClick={() => onRequestDeleteBoard(board)} title="Hapus kolom">×</button>}
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
          </div>

          {canEdit && <button className="add-task-btn" onClick={() => onOpenAddTask(board.id)}>
            Tambah Tugas
          </button>}
        </section>
      )}
    </Droppable>
  );
}
