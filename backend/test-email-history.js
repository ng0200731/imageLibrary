const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

console.log('=== Testing Email History API ===');

try {
    // Check if email_history table exists and has data
    const tableInfo = db.prepare("PRAGMA table_info(email_history)").all();
    console.log('\n=== Email History Table Schema ===');
    tableInfo.forEach(col => {
        console.log(`${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // Check existing email history records
    const emailHistory = db.prepare('SELECT * FROM email_history ORDER BY sent_at DESC').all();
    console.log(`\n=== Email History Records (${emailHistory.length}) ===`);
    
    if (emailHistory.length > 0) {
        emailHistory.forEach(record => {
            console.log(`ID: ${record.id}`);
            console.log(`Project ID: ${record.project_id}`);
            console.log(`Recipient: ${record.recipient_email}`);
            console.log(`Sent At: ${record.sent_at}`);
            console.log(`Success: ${record.success}`);
            console.log('---');
        });
    } else {
        console.log('No email history records found');
        
        // Insert a test record for demonstration
        console.log('\n=== Creating Test Email History Record ===');
        
        // First, check if we have any projects
        const projects = db.prepare('SELECT * FROM projects LIMIT 1').all();
        if (projects.length > 0) {
            const testProject = projects[0];
            console.log(`Using project: ${testProject.name} (ID: ${testProject.id})`);
            
            const insertStmt = db.prepare(`
                INSERT INTO email_history (project_id, recipient_email, sender_message, success)
                VALUES (?, ?, ?, ?)
            `);
            
            const result = insertStmt.run(
                testProject.id,
                'test@example.com',
                'Test email message',
                1
            );
            
            console.log(`✅ Test email history record created with ID: ${result.lastInsertRowid}`);
            
            // Verify the record was created
            const newRecord = db.prepare('SELECT * FROM email_history WHERE id = ?').get(result.lastInsertRowid);
            console.log('New record:', newRecord);
        } else {
            console.log('❌ No projects found to create test email history');
        }
    }
    
} catch (error) {
    console.error('❌ Error:', error);
} finally {
    db.close();
    console.log('\nDatabase connection closed.');
}
