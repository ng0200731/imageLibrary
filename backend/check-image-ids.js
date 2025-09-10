const Database = require('better-sqlite3');

try {
    const db = new Database('database.sqlite');
    
    console.log('=== CHECKING IMAGE IDS ===');
    
    // Get all image IDs
    const images = db.prepare('SELECT id, filepath FROM images ORDER BY id').all();
    
    console.log(`Total images in database: ${images.length}`);
    console.log('\nImage IDs and filepaths:');
    
    images.forEach(img => {
        console.log(`ID: ${img.id} - ${img.filepath}`);
    });
    
    // Check specific IDs that were failing
    const testIds = [110, 133, 134];
    console.log('\n=== CHECKING SPECIFIC IDS ===');
    
    testIds.forEach(id => {
        const image = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
        if (image) {
            console.log(`✓ ID ${id} EXISTS: ${image.filepath}`);
        } else {
            console.log(`✗ ID ${id} NOT FOUND`);
        }
    });
    
    db.close();
    
} catch (err) {
    console.error('Error:', err.message);
}
