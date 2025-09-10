const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('database.sqlite');
const uploadDir = './uploads';

function cleanupOrphanedEntries() {
    console.log('=== Database Cleanup Started ===');
    
    // Get all image records from database
    const images = db.prepare('SELECT id, filepath FROM images').all();
    console.log(`Found ${images.length} image records in database`);
    
    let orphanedCount = 0;
    let cleanedCount = 0;
    
    for (const image of images) {
        // Check if the file actually exists
        if (!fs.existsSync(image.filepath)) {
            console.log(`Orphaned entry found: ${image.filepath} (ID: ${image.id})`);
            orphanedCount++;
            
            try {
                // First remove any foreign key references
                db.prepare('DELETE FROM image_tags WHERE image_id = ?').run(image.id);

                // Remove from any projects (update project image_ids)
                const projects = db.prepare('SELECT id, image_ids FROM projects').all();
                for (const project of projects) {
                    const imageIds = JSON.parse(project.image_ids);
                    const updatedIds = imageIds.filter(id => id !== image.id);
                    if (updatedIds.length !== imageIds.length) {
                        db.prepare('UPDATE projects SET image_ids = ? WHERE id = ?')
                          .run(JSON.stringify(updatedIds), project.id);
                        console.log(`  Updated project ${project.id} to remove image ${image.id}`);
                    }
                }

                // Now remove the orphaned database entry
                db.prepare('DELETE FROM images WHERE id = ?').run(image.id);
                cleanedCount++;
                console.log(`✓ Removed orphaned entry: ${image.filepath}`);
            } catch (err) {
                console.error(`✗ Failed to remove entry ${image.id}:`, err.message);
            }
        }
    }
    
    console.log('=== Cleanup Summary ===');
    console.log(`Total records checked: ${images.length}`);
    console.log(`Orphaned entries found: ${orphanedCount}`);
    console.log(`Entries cleaned up: ${cleanedCount}`);
    console.log('=== Database Cleanup Complete ===');
}

function listDuplicateFilepaths() {
    console.log('=== Checking for Duplicate Filepaths ===');
    
    const duplicates = db.prepare(`
        SELECT filepath, COUNT(*) as count 
        FROM images 
        GROUP BY filepath 
        HAVING COUNT(*) > 1
    `).all();
    
    if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} duplicate filepath(s):`);
        duplicates.forEach(dup => {
            console.log(`  ${dup.filepath} (${dup.count} entries)`);
        });
    } else {
        console.log('No duplicate filepaths found.');
    }
}

// Run cleanup
try {
    listDuplicateFilepaths();
    cleanupOrphanedEntries();
} catch (err) {
    console.error('Cleanup failed:', err);
} finally {
    db.close();
}
