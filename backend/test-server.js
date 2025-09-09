const express = require('express');
const Database = require('better-sqlite3');

console.log('Testing server startup...');

try {
    const app = express();
    const db = new Database('database.sqlite');
    console.log('✅ Database connection successful');
    
    app.use(express.json());
    
    // Test endpoint
    app.get('/test', (req, res) => {
        res.json({ message: 'Server is working!' });
    });
    
    // Test PUT endpoint for tags
    app.put('/images/:id/tags', (req, res) => {
        console.log('PUT /images/:id/tags called with:', req.params.id, req.body);
        const imageId = parseInt(req.params.id);
        const { tags } = req.body;
        
        if (!Array.isArray(tags)) {
            return res.status(400).send('Tags must be an array');
        }
        
        try {
            // Test database query
            const testQuery = db.prepare('SELECT COUNT(*) as count FROM images WHERE id = ?');
            const result = testQuery.get(imageId);
            console.log('Image exists check:', result);
            
            res.json({ 
                success: true, 
                imageId: imageId, 
                tags: tags,
                imageExists: result.count > 0
            });
        } catch (err) {
            console.error('Database error:', err);
            res.status(500).json({ error: err.message });
        }
    });
    
    const port = 3000;
    app.listen(port, () => {
        console.log(`✅ Test server running on http://localhost:${port}`);
        console.log('Test endpoints:');
        console.log('  GET  /test');
        console.log('  PUT  /images/:id/tags');
    });
    
} catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
}
