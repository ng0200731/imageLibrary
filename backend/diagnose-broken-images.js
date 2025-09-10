const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('database.sqlite');
const uploadDir = './uploads';

function diagnoseBrokenImages() {
    console.log('=== Comprehensive Broken Image Diagnosis ===');
    
    // Get all images from database
    const images = db.prepare('SELECT id, filepath, created_at FROM images ORDER BY id').all();
    console.log(`Total images in database: ${images.length}`);

    let brokenImages = [];
    let workingImages = [];
    let pathIssues = [];

    for (const image of images) {
        console.log(`\nChecking Image ID ${image.id}:`);
        console.log(`  Database filepath: "${image.filepath}"`);
        console.log(`  Created: ${image.created_at}`);

        // Extract filename from filepath
        const filename = path.basename(image.filepath);

        // Try different path variations
        const pathVariations = [
            image.filepath,
            image.filepath.replace(/\\/g, '/'),
            image.filepath.replace(/\//g, '\\'),
            path.join(uploadDir, filename),
            path.join('./uploads', filename),
            `uploads/${filename}`,
            `uploads\\${filename}`,
            `./${image.filepath}`,
            `.\\${image.filepath.replace(/\//g, '\\')}`,
        ];
        
        let fileExists = false;
        let actualPath = null;
        
        for (const testPath of pathVariations) {
            try {
                if (fs.existsSync(testPath)) {
                    fileExists = true;
                    actualPath = testPath;
                    console.log(`  ✓ File found at: "${actualPath}"`);
                    break;
                }
            } catch (err) {
                // Skip invalid paths
            }
        }
        
        if (!fileExists) {
            console.log(`  ✗ FILE NOT FOUND - BROKEN IMAGE`);
            brokenImages.push({
                id: image.id,
                filepath: image.filepath,
                filename: filename,
                created_at: image.created_at
            });
        } else {
            workingImages.push({
                id: image.id,
                filepath: image.filepath,
                actualPath: actualPath
            });
            
            // Check if the database path matches the actual path
            if (image.filepath !== actualPath) {
                pathIssues.push({
                    id: image.id,
                    dbPath: image.filepath,
                    actualPath: actualPath
                });
                console.log(`  ⚠ Path mismatch - DB: "${image.filepath}" vs Actual: "${actualPath}"`);
            }
        }
    }
    
    console.log('\n=== DIAGNOSIS SUMMARY ===');
    console.log(`Total images: ${images.length}`);
    console.log(`Working images: ${workingImages.length}`);
    console.log(`Broken images: ${brokenImages.length}`);
    console.log(`Path mismatches: ${pathIssues.length}`);
    
    if (brokenImages.length > 0) {
        console.log('\n=== BROKEN IMAGES (Database records without files) ===');
        brokenImages.forEach(img => {
            console.log(`ID ${img.id}: ${img.filepath} (${img.filename}) - Created: ${img.created_at}`);
        });
        
        console.log('\n=== RECOMMENDED ACTIONS ===');
        console.log('1. Remove broken database entries:');
        console.log(`   DELETE FROM images WHERE id IN (${brokenImages.map(img => img.id).join(', ')});`);
        console.log('2. Or run the cleanup script again');
    }
    
    if (pathIssues.length > 0) {
        console.log('\n=== PATH MISMATCHES (May cause serving issues) ===');
        pathIssues.forEach(issue => {
            console.log(`ID ${issue.id}: DB="${issue.dbPath}" vs Actual="${issue.actualPath}"`);
        });
    }
    
    // Check for files without database records
    console.log('\n=== Checking for orphaned files ===');
    if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        const dbFilenames = new Set(images.map(img => path.basename(img.filepath)));
        const orphanedFiles = files.filter(file => !dbFilenames.has(file));
        
        console.log(`Files in uploads: ${files.length}`);
        console.log(`Orphaned files: ${orphanedFiles.length}`);
        
        if (orphanedFiles.length > 0) {
            console.log('Orphaned files:', orphanedFiles.slice(0, 10).join(', '));
            if (orphanedFiles.length > 10) {
                console.log(`... and ${orphanedFiles.length - 10} more`);
            }
        }
    }
}

// Run the diagnosis
try {
    diagnoseBrokenImages();
} catch (err) {
    console.error('Diagnosis failed:', err);
} finally {
    db.close();
}
