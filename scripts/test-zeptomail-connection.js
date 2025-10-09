const nodemailer = require('nodemailer');
require('dotenv').config();

async function testZeptoMailConnection() {
  console.log('🧪 Testing ZeptoMail SMTP Connection...\n');
  
  // Get environment variables
  const smtpHost = process.env.EMAIL_SMTP_HOST;
  const smtpPort = process.env.EMAIL_SMTP_PORT;
  const smtpUser = process.env.EMAIL_SMTP_USER;
  const smtpPassword = process.env.EMAIL_SMTP_PASSWORD;
  const fromEmail = process.env.EMAIL_FROM;
  
  console.log('📧 Email Configuration:');
  console.log(`   Host: ${smtpHost}`);
  console.log(`   Port: ${smtpPort}`);
  console.log(`   User: ${smtpUser}`);
  console.log(`   From: ${fromEmail}`);
  console.log(`   Password: ${smtpPassword ? '[SET]' : '[NOT SET]'}\n`);
  
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !fromEmail) {
    console.error('❌ Missing email configuration in .env file');
    return;
  }
  
  const port = parseInt(smtpPort);
  const isSecurePort = port === 465;
  
  console.log(`🔒 Security Settings:`);
  console.log(`   Port ${port} - Using ${isSecurePort ? 'SSL/TLS' : 'STARTTLS'}`);
  console.log(`   Secure: ${isSecurePort}\n`);
  
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: port,
      secure: isSecurePort,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false,
        servername: smtpHost,
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000, // 10 seconds
      socketTimeout: 10000, // 10 seconds
    });
    
    console.log('🔄 Testing SMTP connection...');
    
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
    
    // Test sending a simple email
    console.log('📤 Sending test email...');
    const info = await transporter.sendMail({
      from: fromEmail,
      to: fromEmail, // Send to self for testing
      subject: 'ZeptoMail Test - Connection Successful',
      html: `
        <h2>🎉 ZeptoMail Connection Test Successful!</h2>
        <p>This email confirms that your ZeptoMail SMTP configuration is working correctly.</p>
        <p><strong>Configuration Details:</strong></p>
        <ul>
          <li>Host: ${smtpHost}</li>
          <li>Port: ${port} (${isSecurePort ? 'SSL/TLS' : 'STARTTLS'})</li>
          <li>User: ${smtpUser}</li>
          <li>From: ${fromEmail}</li>
        </ul>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
    });
    
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}\n`);
    
    console.log('🎉 All tests passed! ZeptoMail is configured correctly.');
    
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    console.error('\n🔍 Troubleshooting suggestions:');
    console.error('   1. Verify your ZeptoMail API key is correct');
    console.error('   2. Check that your domain is verified in ZeptoMail');
    console.error('   3. Ensure the from email matches your verified domain');
    console.error('   4. Check firewall settings for port 465');
    console.error('\n📋 Full error details:');
    console.error(error);
  }
}

testZeptoMailConnection().catch(console.error);