const cors = require('cors');

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://gigsta.ai', 'https://gigsta-backend-edghckg6f7eab3hq.centralus-01.azurewebsites.net']
        : 'http://localhost:5173',
    credentials: true
})); 