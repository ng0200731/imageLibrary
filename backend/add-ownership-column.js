const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

try {
    console.log('Adding ownership column to images table...');
    
    // Check if column already exists
    const tableInfo = db.prepare("PRAGMA table_info(images)").all();
    const hasOwnershipColumn = tableInfo.some(col => col.name === 'ownership');
    
    if (hasOwnershipColumn) {
        console.log('Ownership column already exists. Updating existing records...');
    } else {
        // Add the ownership column
        db.exec(`
            ALTER TABLE images 
            ADD COLUMN ownership TEXT DEFAULT 'eric.brilliant@gmail.com'
        `);
        console.log('Ownership column added successfully.');
    }
    
    // Update all existing images to have the ownership value
    const updateStmt = db.prepare(`
        UPDATE images 
        SET ownership = 'eric.brilliant@gmail.com' 
        WHERE ownership IS NULL OR ownership = ''
    `);
    const result = updateStmt.run();
    console.log(`Updated ${result.changes} existing image(s) with ownership.`);
    
    // Verify the update
    const count = db.prepare("SELECT COUNT(*) as total FROM images").get();
    const ownershipCount = db.prepare("SELECT COUNT(*) as count FROM images WHERE ownership = 'eric.brilliant@gmail.com'").get();
    console.log(`Total images: ${count.total}, Images with ownership: ${ownershipCount.count}`);
    
    console.log('Migration complete!');
} catch (err) {
    console.error('Error adding ownership column:', err);
} finally {
    db.close();
}



