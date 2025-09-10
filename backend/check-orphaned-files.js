const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('database.sqlite');
const uploadDir = './uploads';

function checkOrphanedFiles() {
    console.log('=== Checking for Orphaned Files ===');
    
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
            console.log(`Orphaned file: ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        }
    }
    
    console.log('=== Summary ===');
    console.log(`Total files checked: ${files.length}`);
    console.log(`Orphaned files found: ${orphanedFiles}`);
    console.log(`Total size of orphaned files: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (orphanedFiles > 0) {
        console.log('\nTo clean up orphaned files, you can:');
        console.log('1. Delete them manually from the uploads folder');
        console.log('2. Or create a script to remove them automatically');
    }
}

// Run the check
try {
    checkOrphanedFiles();
} catch (err) {
    console.error('Check failed:', err);
} finally {
    db.close();
}
