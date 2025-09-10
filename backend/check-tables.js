const Database = require('better-sqlite3');

try {
    const db = new Database('database.sqlite');
    
    console.log('=== CHECKING DATABASE TABLES ===');
    
    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    console.log('Tables in database:');
    tables.forEach(table => {
        console.log(`- ${table.name}`);
    });
    
    // Check if project_images table exists
    const projectImagesExists = tables.some(table => table.name === 'project_images');
    console.log(`\nproject_images table exists: ${projectImagesExists}`);
    
    // Show schema for each table
    console.log('\n=== TABLE SCHEMAS ===');
    tables.forEach(table => {
        console.log(`\n${table.name}:`);
        const schema = db.prepare(`PRAGMA table_info(${table.name})`).all();
        schema.forEach(col => {
            console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
    });
    
    db.close();
    
} catch (err) {
    console.error('Error:', err.message);
}
