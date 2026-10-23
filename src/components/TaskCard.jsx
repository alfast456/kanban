import { Draggable } from '@hello-pangea/dnd';
import { dueStatus, formatDueDate } from '../utils/taskUtils.mjs';

export function TaskCard({ task, index, onOpenView, onOpenEdit, onRequestDelete, canEdit = true }) {
  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(dragProvided, dragSnapshot) => (
        <article
          className={`task-card ${dragSnapshot.isDragging ? 'is-dragging' : ''}`}
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
        >
          <div className="task-content" onClick={() => onOpenView(task)}>
            <span className={`task-priority priority-${(task.priority || 'Low').toLowerCase()}`}>
              {task.priority || 'Low'}
            </span>
            <span className="task-title">{task.content}</span>
            {task.description && <span className="task-desc">{task.description}</span>}
            {task.due_date && (
              <span className={`task-due-date due-${dueStatus(task.due_date)}`}>
                ◷ {formatDueDate(task.due_date)}
              </span>
            )}
            {task.checklist_total > 0 && (
              <span className="task-checklist-progress">☑ {task.checklist_done}/{task.checklist_total}</span>
            )}
            {task.labels?.map(label => (
              <span key={label.id} className="task-label" style={{ '--label-color': label.color }}>{label.name}</span>
            ))}
          </div>
          {canEdit && <div className="task-actions">
            <button className="edit-btn" onClick={event => { event.stopPropagation(); onOpenEdit(task); }} aria-label={`Edit tugas ${task.content}`} title="Edit tugas">✎</button>
            <button className="delete-btn" onClick={event => { event.stopPropagation(); onRequestDelete(task); }} aria-label={`Hapus tugas ${task.content}`} title="Hapus tugas">×</button>
          </div>}
        </article>
      )}
    </Draggable>
  );
}
