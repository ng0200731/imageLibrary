const Database = require('better-sqlite3');

try {
    const db = new Database('database.sqlite');
    
    console.log('=== CHECKING PROJECTS ===');
    
    // Get all projects
    const projects = db.prepare('SELECT * FROM projects ORDER BY id').all();
    
    console.log(`Total projects in database: ${projects.length}`);
    
    if (projects.length > 0) {
        console.log('\nProjects found:');
        projects.forEach(project => {
            console.log(`ID: ${project.id}`);
            console.log(`Name: ${project.name}`);
            console.log(`Image IDs: ${project.image_ids}`);
            console.log(`Created: ${project.created_at}`);
            console.log('---');
        });
    } else {
        console.log('\n❌ NO PROJECTS FOUND');
        
        // Check if projects table exists and has correct structure
        console.log('\n=== CHECKING PROJECTS TABLE STRUCTURE ===');
        const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
        console.log('Projects table structure:');
        tableInfo.forEach(col => {
            console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
        
        // Check if there are any records at all
        const count = db.prepare('SELECT COUNT(*) as count FROM projects').get();
        console.log(`\nTotal records in projects table: ${count.count}`);
    }
    
    // Also check images to see if we have data
    console.log('\n=== CHECKING IMAGES ===');
    const imageCount = db.prepare('SELECT COUNT(*) as count FROM images').get();
    console.log(`Total images in database: ${imageCount.count}`);
    
    db.close();
    
} catch (err) {
    console.error('Error:', err.message);
}
