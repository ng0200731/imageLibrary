const Database = require('better-sqlite3');

const db = new Database('database.sqlite');

try {
    // Get table schema
    console.log('=== Database Schema ===');
    
    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', tables.map(t => t.name));
    
    // Get images table schema
    const imageSchema = db.prepare("PRAGMA table_info(images)").all();
    console.log('\n=== Images Table Schema ===');
    imageSchema.forEach(col => {
        console.log(`${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // Get a sample record
    const sampleImage = db.prepare("SELECT * FROM images LIMIT 1").get();
    console.log('\n=== Sample Image Record ===');
    console.log(sampleImage);
    
    // Count total images
    const count = db.prepare("SELECT COUNT(*) as count FROM images").get();
    console.log(`\nTotal images in database: ${count.count}`);
    
} catch (err) {
    console.error('Error:', err);
} finally {
    db.close();
}
