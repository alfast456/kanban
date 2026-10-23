const test = require('node:test');
const assert = require('node:assert/strict');
const { insertAt, reindex } = require('../server/services/taskPositions');

test('insertAt inserts at start, middle, and end', () => {
    const list = [{ id: 1 }, { id: 2 }];
    assert.deepEqual(insertAt(list, { id: 3 }, 0), [{ id: 3 }, { id: 1 }, { id: 2 }]);
    assert.deepEqual(insertAt(list, { id: 3 }, 1), [{ id: 1 }, { id: 3 }, { id: 2 }]);
    assert.deepEqual(insertAt(list, { id: 3 }, 2), [{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert.deepEqual(insertAt(list, { id: 3 }, 99), [{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert.deepEqual(insertAt(list, { id: 3 }, -5), [{ id: 3 }, { id: 1 }, { id: 2 }]);
});

test('reindex assigns sequential 0-based positions', () => {
    const list = [{ id: 10, position: 5 }, { id: 20, position: 99 }];
    const result = reindex(list);
    assert.deepEqual(result, [
        { id: 10, position: 0 },
        { id: 20, position: 1 },
    ]);
});
