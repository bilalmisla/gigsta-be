const User = require('./user.model');
const Message = require('./message.model');
const Gig = require('./gig.model');
const Conversation = require('./conversation.model');
const Order = require('./order.model');
const Review = require('./review.model');
const OrderStatus = require('./orderStatus.model');
const Withdrawal = require('./withdrawal.model');
const Notification = require('./notification.model');
const PaymentMethod = require('./paymentMethod.model');
const StudentInvite = require('./studentInvite.model');
const Coupon = require('./coupon.model');

module.exports = {
    User,
    Message,
    Gig,
    Conversation,
    Order,
    Review,
    OrderStatus,
    Withdrawal,
    PaymentMethod,
    Notification,
    StudentInvite,
    Coupon
}
