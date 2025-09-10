const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

// Test inserting a duplicate filepath
const testFilepath = './uploads/test-duplicate.jpg';

console.log('=== Testing UNIQUE constraint behavior ===');

// First, check if this filepath already exists
const existing = db.prepare('SELECT id, filepath FROM images WHERE filepath = ?').get(testFilepath);
if (existing) {
    console.log('Found existing record:', existing);
} else {
    console.log('No existing record found for:', testFilepath);
}

// Try to insert the test filepath
const insertImage = db.prepare(`
    INSERT INTO images (filepath, book, page, row, column, type, material, dimension, remark, brand, color, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

try {
    console.log('Attempting to insert:', testFilepath);
    const result = insertImage.run(
        testFilepath,
        null, null, null, null, null, null, null, null, null, null
    );
    console.log('Insert successful:', result);
} catch (err) {
    console.log('Insert failed:');
    console.log('Error code:', err.code);
    console.log('Error message:', err.message);
    console.log('Full error:', err);
}

// Try to insert the same filepath again to trigger UNIQUE constraint
try {
    console.log('Attempting to insert duplicate:', testFilepath);
    const result2 = insertImage.run(
        testFilepath,
        null, null, null, null, null, null, null, null, null, null
    );
    console.log('Second insert successful (unexpected):', result2);
} catch (err) {
    console.log('Second insert failed (expected):');
    console.log('Error code:', err.code);
    console.log('Error message:', err.message);
    console.log('Error includes UNIQUE:', err.message.includes('UNIQUE constraint failed'));
}

// Clean up - remove the test record
try {
    const deleteResult = db.prepare('DELETE FROM images WHERE filepath = ?').run(testFilepath);
    console.log('Cleanup successful, deleted rows:', deleteResult.changes);
} catch (err) {
    console.log('Cleanup failed:', err.message);
}

db.close();
console.log('=== Test complete ===');
