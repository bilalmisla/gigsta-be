const userRoute = require('./user.route');
const conversationRoute = require('./conversation.route');
const gigRoute = require('./gig.route');
const messageRoute = require('./message.route');
const orderRoute = require('./order.route');
const reviewRoute = require('./review.route');
const authRoute = require('./auth.route');
const contactRoute = require('./contact.route');
const paymentMethodRoute = require('./paymentMethod.route');
const notificationRoute = require('./notification.route');

module.exports = {
    authRoute,
    userRoute,
    conversationRoute,
    gigRoute,
    messageRoute,
    orderRoute,
    reviewRoute,
    contactRoute,
    paymentMethodRoute,
    notificationRoute
}
