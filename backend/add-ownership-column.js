const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

try {
    console.log('Adding ownership column to images table...');
    db.exec("ALTER TABLE images ADD COLUMN ownership TEXT DEFAULT 'eric.brilliant@gmail.com'");
    console.log('✅ Added ownership column');
    
    const result = db.prepare("UPDATE images SET ownership = 'eric.brilliant@gmail.com' WHERE ownership IS NULL OR ownership = ''").run();
    console.log(`✅ Updated ${result.changes} existing images with ownership`);
} catch(err) {
    if(err.message.includes('duplicate column') || err.message.includes('already exists')) {
        console.log('✅ ownership column already exists');
    } else {
        console.error('Error:', err.message);
    }
}

db.close();
