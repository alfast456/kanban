function insertAt(tasks, task, position) {
    const index = Math.min(Math.max(position, 0), tasks.length);
    return [...tasks.slice(0, index), task, ...tasks.slice(index)];
}

function reindex(tasks) {
    return tasks.map((task, position) => ({ ...task, position }));
}

module.exports = { insertAt, reindex };
