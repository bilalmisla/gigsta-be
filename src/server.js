require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connect = require('./configs/db');
const PORT = 8080;
const http = require('http');
const { initSocket } = require('./server-realtime');

// Other Route files
const { 
    userRoute, conversationRoute, gigRoute, messageRoute, 
    orderRoute, reviewRoute, authRoute, contactRoute, paymentMethodRoute, notificationRoute, studentInviteRoute, adminRoute, couponRoute, assistantRoute
} = require('./routes');
const { OrderStatus } = require('./models');
const autoUpdateCollections = require('./utils/autoUpdateCollections');

// App
const app = express();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 
        'https://gigsta.ai', 'https://gigstafrontend.netlify.app', 'https://staging.gigsta.ai', 'https://admin.gigsta.ai'],
    credentials: true
}));

// Other Routes
app.use('/api/auth', authRoute);
app.use('/api/users', userRoute);
app.use('/api/gigs', gigRoute);
app.use('/api/conversations', conversationRoute);
app.use('/api/orders', orderRoute);
app.use('/api/messages', messageRoute);
app.use('/api/reviews', reviewRoute);
app.use('/api/submit-form', contactRoute);
app.use('/api/pm', paymentMethodRoute);
app.use('/api/notifications', notificationRoute);
app.use('/api/student-invites', studentInviteRoute);
app.use('/api/admin', adminRoute);
app.use('/api/coupons', couponRoute);
app.use('/api/assistant', assistantRoute);

// const updateAllRecords = async () => {
//     const result = await OrderStatus.updateMany({}, { $set: { revisionRequestedCount: 0 } });
//     console.log('Documents updated:', result.modifiedCount);
// };

// updateAllRecords();

// Routes
app.get('/', (request, response) => {
    response.send('Hello, Topper!');
});

app.get('/ip', (request, response) => {
    const list = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    const ips = list.split(',');

    return response.send({ ip: ips[0] });
})

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, async () => {
    try {
        await connect();
        console.log(`🚀 Listening at http://localhost:${PORT}`);
        // await autoUpdateCollections();
        // console.log('✅ All collections updated with missing schema fields.');
    }
    catch ({ message }) {
        console.log(message);
    }
});
