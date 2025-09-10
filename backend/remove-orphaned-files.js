const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('database.sqlite');
const uploadDir = './uploads';

function removeOrphanedFiles(dryRun = true) {
    console.log('=== Removing Orphaned Files ===');
    console.log(`Mode: ${dryRun ? 'DRY RUN (no files will be deleted)' : 'LIVE RUN (files will be deleted)'}`);
    
    // Get all filepaths from database
    const dbFilepaths = new Set();
    const images = db.prepare('SELECT filepath FROM images').all();
    images.forEach(img => {
        dbFilepaths.add(img.filepath);
        // Also add normalized path (in case of path separator differences)
        dbFilepaths.add(img.filepath.replace(/\\/g, '/'));
        dbFilepaths.add(img.filepath.replace(/\//g, '\\'));
    });
    
    console.log(`Database has ${dbFilepaths.size} unique filepaths`);
    
    // Get all files in uploads directory
    if (!fs.existsSync(uploadDir)) {
        console.log('Uploads directory does not exist');
        return;
    }
    
    const files = fs.readdirSync(uploadDir);
    console.log(`Found ${files.length} files in uploads directory`);
    
    let orphanedFiles = 0;
    let totalSize = 0;
    let deletedFiles = 0;
    let deletedSize = 0;
    
    for (const file of files) {
        const fullPath = path.join(uploadDir, file);
        const relativePath = `uploads/${file}`;
        const relativePathBackslash = `uploads\\${file}`;
        const dotPath = `./${relativePath}`;
        const dotPathBackslash = `.\\${relativePathBackslash}`;
        
        // Check if this file exists in database with any path format
        const existsInDb = dbFilepaths.has(fullPath) || 
                          dbFilepaths.has(relativePath) || 
                          dbFilepaths.has(relativePathBackslash) ||
                          dbFilepaths.has(dotPath) ||
                          dbFilepaths.has(dotPathBackslash);
        
        if (!existsInDb) {
            const stats = fs.statSync(fullPath);
            totalSize += stats.size;
            orphanedFiles++;
            
            console.log(`${dryRun ? '[DRY RUN]' : '[DELETING]'} ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
            
            if (!dryRun) {
                try {
                    fs.unlinkSync(fullPath);
                    deletedFiles++;
                    deletedSize += stats.size;
                    console.log(`  ✓ Deleted successfully`);
                } catch (err) {
                    console.error(`  ✗ Failed to delete: ${err.message}`);
                }
            }
        }
    }
    
    console.log('=== Summary ===');
    console.log(`Total files checked: ${files.length}`);
    console.log(`Orphaned files found: ${orphanedFiles}`);
    console.log(`Total size of orphaned files: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (!dryRun) {
        console.log(`Files deleted: ${deletedFiles}`);
        console.log(`Space freed: ${(deletedSize / 1024 / 1024).toFixed(2)} MB`);
    } else {
        console.log('\nTo actually delete these files, run:');
        console.log('node remove-orphaned-files.js --delete');
    }
}

// Check command line arguments
const args = process.argv.slice(2);
const shouldDelete = args.includes('--delete') || args.includes('-d');

// Run the cleanup
try {
    removeOrphanedFiles(!shouldDelete); // dryRun = true unless --delete flag
} catch (err) {
    console.error('Cleanup failed:', err);
} finally {
    db.close();
}
