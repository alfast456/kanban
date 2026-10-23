export const PRIORITIES = ['Low', 'Medium', 'High'];

export function dueStatus(dueDate) {
  if (!dueDate) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return 'overdue';
  if (days <= 2) return 'soon';
  return 'upcoming';
}

export function formatDueDate(dueDate) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${dueDate.slice(0, 10)}T00:00:00`));
}
