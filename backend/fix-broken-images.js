const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('database.sqlite');

console.log('=== Fixing Broken Images ===\n');

// Get all images from database
const images = db.prepare('SELECT id, filepath FROM images ORDER BY id').all();
console.log(`Total images in database: ${images.length}\n`);

let brokenCount = 0;
const brokenImageIds = [];

for (const image of images) {
    // Normalize the filepath
    let normalizedPath = image.filepath;
    
    // Remove leading ./ if present
    if (normalizedPath.startsWith('./')) {
        normalizedPath = normalizedPath.substring(2);
    }
    
    // Convert backslashes to forward slashes
    normalizedPath = normalizedPath.replace(/\\/g, '/');
    
    // Check if file exists
    const fullPath = path.resolve(normalizedPath);
    const fileExists = fs.existsSync(fullPath);
    
    if (!fileExists) {
        brokenCount++;
        brokenImageIds.push(image.id);
        console.log(`❌ Found broken image ID ${image.id}: "${image.filepath}"`);
    }
}

if (brokenCount === 0) {
    console.log('✅ No broken images found. All images are valid.');
    db.close();
    process.exit(0);
}

console.log(`\n=== Removing ${brokenCount} broken image(s) from database ===\n`);

// Use a transaction to safely remove broken images
const removeBrokenImage = db.transaction((imageId) => {
    console.log(`Removing image ID ${imageId}...`);
    
    // Remove from image_tags table
    const tagLinksRemoved = db.prepare('DELETE FROM image_tags WHERE image_id = ?').run(imageId).changes;
    console.log(`  - Removed ${tagLinksRemoved} tag link(s)`);
    
    // Remove from projects (update image_ids field)
    const projects = db.prepare('SELECT id, image_ids FROM projects').all();
    let projectsUpdated = 0;
    projects.forEach(project => {
        try {
            // Try JSON parse first
            let imageIds = [];
            if (project.image_ids.startsWith('[') && project.image_ids.endsWith(']')) {
                imageIds = JSON.parse(project.image_ids);
            } else {
                // Handle comma-separated format
                imageIds = project.image_ids
                    .split(',')
                    .map(id => parseInt(id.trim()))
                    .filter(id => !isNaN(id));
            }
            
            if (imageIds.includes(imageId)) {
                const updatedImageIds = imageIds.filter(id => id !== imageId);
                const updatedImageIdsStr = Array.isArray(updatedImageIds) 
                    ? JSON.stringify(updatedImageIds) 
                    : updatedImageIds.join(',');
                db.prepare('UPDATE projects SET image_ids = ? WHERE id = ?').run(updatedImageIdsStr, project.id);
                projectsUpdated++;
                console.log(`  - Removed from project ${project.id}`);
            }
        } catch (err) {
            console.warn(`  - Warning: Could not update project ${project.id}: ${err.message}`);
        }
    });
    
    // Remove from images table
    const imagesRemoved = db.prepare('DELETE FROM images WHERE id = ?').run(imageId).changes;
    console.log(`  - Removed image record: ${imagesRemoved > 0 ? '✅' : '❌'}`);
    
    return { tagLinksRemoved, projectsUpdated, imagesRemoved };
});

// Remove all broken images
for (const imageId of brokenImageIds) {
    try {
        removeBrokenImage(imageId);
        console.log(`✅ Successfully removed image ID ${imageId}\n`);
    } catch (err) {
        console.error(`❌ Error removing image ID ${imageId}: ${err.message}\n`);
    }
}

console.log(`\n=== Summary ===`);
console.log(`Broken images found: ${brokenCount}`);
console.log(`Broken images removed: ${brokenImageIds.length}`);
console.log(`\n✅ Cleanup complete! The error message should no longer appear.`);

db.close();

