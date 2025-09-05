const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Email Configuration
const GMAIL_CONFIG = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'eric.brilliant@gmail.com',
        pass: 'opqx pfna kagb bznr'
    }
};

const BACKUP_CONFIG = {
    host: 'smtp.163.com',
    port: 465,
    secure: true,
    auth: {
        user: '19902475292@163.com',
        pass: 'JDy8MigeNmsESZRa'
    }
};

/**
 * Send project share email with embedded images
 * @param {Object} projectData - Project information and images
 * @param {string} recipientEmail - Email address to send to
 * @param {string} senderMessage - Optional personal message
 * @returns {Promise<boolean>} - True if email sent successfully
 */
async function sendProjectEmail(projectData, recipientEmail, senderMessage = '') {
    console.log('=== EMAIL SERVICE DEBUG ===');
    console.log('Project:', projectData.name);
    console.log('Recipient:', recipientEmail);
    console.log('Images count:', projectData.images ? projectData.images.length : 0);

    try {
        // Try Gmail first, then fallback to 163.com
        console.log('Attempting Gmail SMTP...');
        let success = await sendWithGmail(projectData, recipientEmail, senderMessage);
        if (!success) {
            console.log('Gmail failed, trying 163.com backup...');
            success = await sendWithBackup(projectData, recipientEmail, senderMessage);
        }

        console.log('Email sending result:', success);
        return success;
    } catch (error) {
        console.error('Error sending project email:', error);
        return false;
    }
}

/**
 * Send email using Gmail SMTP
 */
async function sendWithGmail(projectData, recipientEmail, senderMessage) {
    try {
        console.log('Creating Gmail transporter...');
        const transporter = nodemailer.createTransport(GMAIL_CONFIG);

        console.log('Creating email options...');
        const mailOptions = await createEmailOptions(
            projectData,
            recipientEmail,
            senderMessage,
            GMAIL_CONFIG.auth.user
        );

        console.log('Sending email via Gmail...');
        console.log('Mail options:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
            attachments: mailOptions.attachments ? mailOptions.attachments.length : 0
        });

        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully via Gmail to ${recipientEmail}`);
        return true;
    } catch (error) {
        console.error('Gmail sending failed:', error.message);
        console.error('Full error:', error);
        return false;
    }
}

/**
 * Send email using 163.com SMTP
 */
async function sendWithBackup(projectData, recipientEmail, senderMessage) {
    try {
        const transporter = nodemailer.createTransport(BACKUP_CONFIG);
        
        const mailOptions = await createEmailOptions(
            projectData, 
            recipientEmail, 
            senderMessage, 
            BACKUP_CONFIG.auth.user
        );
        
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully via 163.com to ${recipientEmail}`);
        return true;
    } catch (error) {
        console.error('163.com sending failed:', error);
        return false;
    }
}

/**
 * Create email options with HTML content and embedded images
 */
async function createEmailOptions(projectData, recipientEmail, senderMessage, fromEmail) {
    const htmlContent = generateHtmlContent(projectData, senderMessage);
    
    const mailOptions = {
        from: fromEmail,
        to: recipientEmail,
        subject: projectData.name,
        html: htmlContent,
        attachments: []
    };
    
    // Add embedded images
    for (let i = 0; i < projectData.images.length; i++) {
        const image = projectData.images[i];
        try {
            const imagePath = path.resolve(image.filepath);
            if (fs.existsSync(imagePath)) {
                mailOptions.attachments.push({
                    filename: `image${i}.jpg`,
                    path: imagePath,
                    cid: `image${i}` // Content-ID for embedding
                });
            }
        } catch (error) {
            console.error(`Error embedding image ${image.filepath}:`, error);
        }
    }
    
    return mailOptions;
}

/**
 * Generate HTML email content
 */
function generateHtmlContent(projectData, senderMessage) {
    const currentTime = new Date().toLocaleString();
    
    // Get all unique tags
    const allTags = new Set();
    projectData.images.forEach(image => {
        if (image.tags) {
            image.tags.forEach(tag => allTags.add(tag));
        }
    });
    
    const tagsStr = allTags.size > 0 ? Array.from(allTags).sort().join(', ') : 'No tags';
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${projectData.name}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border: 2px solid #000; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .project-info { background: #f9f9f9; padding: 20px; margin-bottom: 30px; border: 1px solid #ddd; }
            .images-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .image-item { text-align: center; border: 1px solid #ddd; padding: 10px; background: white; }
            .image-item img { max-width: 100%; height: 200px; object-fit: cover; border: 1px solid #ccc; }
            .image-tags { font-size: 12px; color: #666; margin-top: 8px; }
            .footer { text-align: center; border-top: 2px solid #000; padding-top: 20px; margin-top: 30px; color: #666; }
            h1 { color: #000; margin: 0; }
            h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📁 ${projectData.name}</h1>
                <p>Shared from Image Library System</p>
            </div>
    `;
    
    if (senderMessage) {
        html += `
            <div class="project-info">
                <h2>📝 Personal Message</h2>
                <p>${senderMessage}</p>
            </div>
        `;
    }
    
    html += `
            <div class="project-info">
                <h2>📊 Project Details</h2>
                <p><strong>Project Name:</strong> ${projectData.name}</p>
                <p><strong>Total Images:</strong> ${projectData.images.length} images</p>
                <p><strong>Created:</strong> ${projectData.created_at || 'Unknown'}</p>
                <p><strong>Tags:</strong> ${tagsStr}</p>
            </div>
            
            <h2>🖼️ Project Images</h2>
            <div class="images-grid">
    `;
    
    // Add images to grid
    projectData.images.forEach((image, i) => {
        const imageTags = image.tags && image.tags.length > 0 ? image.tags.join(', ') : 'No tags';
        html += `
                <div class="image-item">
                    <img src="cid:image${i}" alt="Project Image ${i+1}">
                    <div class="image-tags">Tags: ${imageTags}</div>
                </div>
        `;
    });
    
    html += `
            </div>
            
            <div class="footer">
                <p>This email was sent from the Image Library application.</p>
                <p>Project shared on: ${currentTime}</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    return html;
}

module.exports = {
    sendProjectEmail
};
