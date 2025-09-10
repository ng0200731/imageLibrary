console.log('Starting simple test...');

try {
    const Database = require('better-sqlite3');
    console.log('better-sqlite3 loaded');
    
    const db = new Database('database.sqlite');
    console.log('Database connected');
    
    const count = db.prepare('SELECT COUNT(*) as count FROM images').get();
    console.log('Image count:', count.count);
    
    db.close();
    console.log('Database closed');
    
} catch (err) {
    console.error('Error:', err);
}
