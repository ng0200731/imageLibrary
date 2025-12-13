const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

console.log('=== Migrating dimension to width and length ===\n');

try {
    // Check if width column exists
    const tableInfo = db.prepare("PRAGMA table_info(images)").all();
    const hasWidth = tableInfo.some(col => col.name === 'width');
    const hasLength = tableInfo.some(col => col.name === 'length');
    
    if (!hasWidth) {
        console.log('Adding width column...');
        db.exec('ALTER TABLE images ADD COLUMN width TEXT');
        console.log('✅ width column added');
    } else {
        console.log('width column already exists');
    }
    
    if (!hasLength) {
        console.log('Adding length column...');
        db.exec('ALTER TABLE images ADD COLUMN length TEXT');
        console.log('✅ length column added');
    } else {
        console.log('length column already exists');
    }
    
    // Migrate existing dimension data to width and length if dimension exists
    if (tableInfo.some(col => col.name === 'dimension')) {
        console.log('\nMigrating existing dimension data...');
        const images = db.prepare("SELECT id, dimension FROM images WHERE dimension IS NOT NULL AND dimension != ''").all();
        
        let migrated = 0;
        for (const image of images) {
            // Try to parse dimension like "25x30mm" or "25x30"
            const dimension = image.dimension.trim();
            const match = dimension.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
            
            if (match) {
                const width = match[1];
                const length = match[2];
                db.prepare('UPDATE images SET width = ?, length = ? WHERE id = ?').run(width, length, image.id);
                migrated++;
            }
        }
        
        console.log(`✅ Migrated ${migrated} dimension values to width and length`);
    }
    
    console.log('\n✅ Migration complete!');
    
} catch (error) {
    console.error('❌ Migration error:', error);
} finally {
    db.close();
}

