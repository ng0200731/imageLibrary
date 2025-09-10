const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { verbose: console.log });

function addEmailHistoryTable() {
    console.log('=== Adding Email History Table ===');
    
    try {
        // Create email_history table
        db.exec(`
            CREATE TABLE IF NOT EXISTS email_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                recipient_email TEXT NOT NULL,
                sender_message TEXT,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN DEFAULT 1,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
            );
        `);
        
        console.log('✅ Email history table created successfully');
        
        // Check if table was created properly
        const tableInfo = db.prepare("PRAGMA table_info(email_history)").all();
        console.log('\n=== Email History Table Schema ===');
        tableInfo.forEach(col => {
            console.log(`${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
        
    } catch (error) {
        console.error('❌ Error creating email history table:', error);
    }
}

addEmailHistoryTable();
db.close();
console.log('Database connection closed.');
