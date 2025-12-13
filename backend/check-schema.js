const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

console.log('=== Checking database schema ===\n');

try {
    const tableInfo = db.prepare("PRAGMA table_info(images)").all();
    
    console.log('Columns in images table:');
    tableInfo.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
    });
    
    const hasWidth = tableInfo.some(col => col.name === 'width');
    const hasLength = tableInfo.some(col => col.name === 'length');
    const hasDimension = tableInfo.some(col => col.name === 'dimension');
    
    console.log(`\nWidth column exists: ${hasWidth}`);
    console.log(`Length column exists: ${hasLength}`);
    console.log(`Dimension column exists: ${hasDimension}`);
    
    if (!hasWidth) {
        console.log('\n⚠️  Width column is missing! Adding it now...');
        db.exec('ALTER TABLE images ADD COLUMN width TEXT');
        console.log('✅ Width column added');
    }
    
    if (!hasLength) {
        console.log('\n⚠️  Length column is missing! Adding it now...');
        db.exec('ALTER TABLE images ADD COLUMN length TEXT');
        console.log('✅ Length column added');
    }
    
    // Verify again
    const tableInfoAfter = db.prepare("PRAGMA table_info(images)").all();
    const hasWidthAfter = tableInfoAfter.some(col => col.name === 'width');
    const hasLengthAfter = tableInfoAfter.some(col => col.name === 'length');
    
    console.log(`\n✅ Final check - Width: ${hasWidthAfter}, Length: ${hasLengthAfter}`);
    
} catch (error) {
    console.error('❌ Error:', error);
} finally {
    db.close();
}
