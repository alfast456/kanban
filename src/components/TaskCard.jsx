import { Draggable } from '@hello-pangea/dnd';
import { dueStatus, formatDueDate } from '../utils/taskUtils.mjs';
import { IconClock, IconChecklist, IconEdit, IconTrash } from './Icons';

export function TaskCard({ task, index, onOpenView, onOpenEdit, onRequestDelete, canEdit = true }) {
  const priority = task.priority || 'Low';
  const priorityKey = priority.toLowerCase();
  const status = task.due_date ? dueStatus(task.due_date) : '';

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(dragProvided, dragSnapshot) => (
        <article
          className={`task-card ${dragSnapshot.isDragging ? 'is-dragging' : ''} priority-border-${priorityKey}`}
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
        >
          <div className="task-content" onClick={() => onOpenView(task)}>
            <div className="task-card-header">
              <span className={`task-priority priority-${priorityKey}`}>
                <span className="priority-dot" aria-hidden="true" />
                {priority}
              </span>
              {task.due_date && (
                <span className={`task-due-date due-${status}`} title={`Tenggat: ${formatDueDate(task.due_date)}`}>
                  <IconClock size={12} />
                  <span>{formatDueDate(task.due_date)}</span>
                </span>
              )}
            </div>

            <span className="task-title">{task.content}</span>
            {task.description && <span className="task-desc">{task.description}</span>}

            {(task.checklist_total > 0 || (task.labels && task.labels.length > 0)) && (
              <div className="task-card-footer">
                {task.checklist_total > 0 && (
                  <span className={`task-checklist-progress ${task.checklist_done === task.checklist_total ? 'all-done' : ''}`}>
                    <IconChecklist size={12} />
                    <span>{task.checklist_done}/{task.checklist_total}</span>
                  </span>
                )}
                {task.labels?.map(label => (
                  <span key={label.id} className="task-label" style={{ '--label-color': label.color }}>
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="task-actions">
              <button
                type="button"
                className="edit-btn"
                onClick={event => {
                  event.stopPropagation();
                  onOpenEdit(task);
                }}
                aria-label={`Edit tugas ${task.content}`}
                title="Edit tugas"
              >
                <IconEdit size={14} />
              </button>
              <button
                type="button"
                className="delete-btn"
                onClick={event => {
                  event.stopPropagation();
                  onRequestDelete(task);
                }}
                aria-label={`Hapus tugas ${task.content}`}
                title="Hapus tugas"
              >
                <IconTrash size={14} />
              </button>
            </div>
          )}
        </article>
      )}
    </Draggable>
  );
}
