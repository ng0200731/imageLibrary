const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('database.sqlite');
const uploadDir = './uploads';

console.log('=== Checking for Broken Images ===\n');

// Get all images from database
const images = db.prepare('SELECT id, filepath FROM images ORDER BY id').all();
console.log(`Total images in database: ${images.length}\n`);

let brokenCount = 0;
const brokenImages = [];

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
    
    // Construct the URL that frontend would use
    const frontendUrl = `http://localhost:3000/${normalizedPath}`;
    
    if (!fileExists) {
        brokenCount++;
        brokenImages.push({
            id: image.id,
            originalFilepath: image.filepath,
            normalizedPath: normalizedPath,
            fullPath: fullPath,
            frontendUrl: frontendUrl
        });
        
        console.log(`❌ BROKEN - Image ID ${image.id}:`);
        console.log(`   Original filepath: "${image.filepath}"`);
        console.log(`   Normalized: "${normalizedPath}"`);
        console.log(`   Full path: "${fullPath}"`);
        console.log(`   Frontend URL: "${frontendUrl}"`);
        console.log(`   File exists: ${fileExists}\n`);
    }
}

console.log(`\n=== Summary ===`);
console.log(`Total images: ${images.length}`);
console.log(`Broken images: ${brokenCount}`);

if (brokenCount > 0) {
    console.log(`\n=== Broken Image IDs ===`);
    console.log(brokenImages.map(img => img.id).join(', '));
}

db.close();

