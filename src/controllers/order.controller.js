const { Order, Gig, User, OrderStatus, Withdrawal, Coupon } = require('../models');
const { CustomException } = require('../utils');
const { sendBuyerOrderConfirmationEmail, sendSellerOrderNotificationEmail, sendSellerWithdrawalNotificationEmail, sendSellerWithdrawalStatusUpdateEmail, sendExtendDeliveryRequestEmail, sendExtendDeliveryApprovalEmail, sendExtendDeliveryRejectionEmail } = require('../utils/emailTemplates');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const nodemailer = require('nodemailer');
const { sendOrderStatusEmail } = require('../utils/sendOrderStatusEmail');
const { createNotification } = require('./notification.controller');
const { emitToUser } = require('../server-realtime');

// const getOrders = async (request, response) => {
//     try {
//         const orders = await Order.find({
//             $or: [
//                 { buyerID: request.userID },
//                 { gigs: { $elemMatch: { sellerID: request.userID } } }
//             ]
//         })
//         .populate('buyerID', 'username email image country')
//         .populate('gigs.sellerID', 'username email image country');

//         const updatedOrders = orders.map((item, index) => {
//             if (item._doc.buyerID._id.toString() === request.userID) {
//                 return item;
//             }
//             return {
//                 ...item._doc,
//                 gigs: item._doc.gigs.filter((gig, index) => gig._doc.sellerID._id.toString() === request.userID)
//             };
//         });

//         return response.send(updatedOrders);
//     }
//     catch ({ message, status = 500 }) {
//         return response.send({
//             error: true,
//             message
//         })
//     }
// }

const getOrders = async (request, response) => {
    try {
        const orders = await Order.find({
            $or: [
                { buyerID: request.userID },
                { gigs: { $elemMatch: { sellerID: request.userID } } }
            ]
        })
            .populate('buyerID', 'username fullname email image country')
            .populate('gigs.sellerID', 'username fullname email image country').sort({ createdAt: -1 });

        // Filter gigs for sellers
        const updatedOrders = orders.map(item => {
            if (item._doc.buyerID?._id.toString() === request.userID) {
                return item._doc;
            }
            return {
                ...item._doc,
                gigs: item._doc.gigs.filter(gig => gig._doc.sellerID?._id.toString() === request.userID)
            };
        });

        // Fetch relevant OrderStatus documents
        const orderIDs = updatedOrders.map(order => order._id);
        const orderStatuses = await OrderStatus.find({
            orderID: { $in: orderIDs }
        })
            .populate('buyerID', 'username fullname email image country')
            .populate('sellerID', 'username fullname email image country')
            .populate('gigID', 'title price') // adjust fields as needed
            .lean();

        // Group statuses by orderID
        const statusesMap = {};
        orderStatuses.forEach(status => {
            const key = status.orderID.toString();
            if (!statusesMap[key]) statusesMap[key] = [];
            statusesMap[key].push(status);
        });

        // Attach statuses + current status to each order
        const enrichedOrders = updatedOrders.map(order => {
            const statuses = statusesMap[order._id.toString()] || [];

            // sort statuses by createdAt (or updatedAt if that's what you want)
            const sortedStatuses = statuses.sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );

            const currentStatus = sortedStatuses.length > 0 ? sortedStatuses[sortedStatuses.length - 1] : null;

            return {
                ...order,
                orderStatuses: sortedStatuses,
                currentStatus
            };
        });

        return response.send(enrichedOrders);
    }
    catch (error) {
        return response.status(500).send({
            error: true,
            message: error.message
        });
    }
}

const getOrderDetailsById = async (request, response) => {
    try {
        const { id, gig_id } = request.params;

        // Find order by ID and populate related fields
        const order = await Order.findById(id)
            .populate('buyerID', 'username fullname email image country')
            .populate('gigs.sellerID', 'username fullname email image country isSeller');

        if (!order) {
            return response.status(404).send({ error: true, message: 'Order not found' });
        }

        const userId = request.userID;

        // Check access: buyer or one of the sellers
        const isBuyer = order.buyerID._id.toString() === userId;
        const isSeller = order.gigs.some(gig => gig.sellerID._id.toString() === userId);

        if (!isBuyer && !isSeller) {
            return response.status(403).send({ error: true, message: 'Access denied' });
        }

        const gig = await Gig.findById({ _id: gig_id })
            .populate('userID', 'username fullname country image createdAt email description isSeller');

        if (!gig) {
            throw CustomException('Gig not found!', 404);
        }

        // Get all relevant order status entries for this order
        const orderStatuses = await OrderStatus.find({
            orderID: order._doc._id,
            deletedAt: null
        }).sort({ createdAt: -1 });
        const currentStatus = await OrderStatus.findOne({
            orderID: order._doc._id,
            deletedAt: null
        }).sort({ createdAt: -1 });

        // Add status to each gig
        const enrichGigsWithStatus = (gig) => {
            // const status = orderStatuses.find(status =>
            //     status.gigID?.toString() === gig._id.toString()
            // );
            // if (status) {
            //     return {
            //         ...gig.toObject(),
            //         orderStatusDetails: status,
            //         status: status.status
            //     }
            // } else {
            return {
                ...gig.toObject(),
            };
            // }
        }

        // Filter out gigs not belonging to this seller (if not buyer)
        if (!isBuyer) {
            // const sellerGigs = order.gigs.filter(gig => gig.sellerID._id.toString() === userId);
            // console.log(sellerGigs, "sellerGigs");
            const filteredOrder = {
                ...order._doc,
                gig: enrichGigsWithStatus(gig),
                orderStatuses: orderStatuses,
                currentStatus: currentStatus
            };
            return response.send(filteredOrder);
        }

        // If buyer, return all gigs enriched
        const fullOrder = {
            ...order._doc,
            gig: enrichGigsWithStatus(gig),
            orderStatuses: orderStatuses,
            currentStatus: currentStatus
        };

        return response.send(fullOrder);
    } catch (err) {
        return response.status(err.status || 500).send({
            error: true,
            message: err.message || 'Server error'
        });
    }
};

// const paymentIntent = async (request, response) => {
//     const { _id } = request.params;

//     try {
//         const gig = await Gig.findOne({ _id });

//         const payment_intent = await stripe.paymentIntents.create({
//             amount: gig.price * 100,
//             currency: "USD",
//             automatic_payment_methods: {
//                 enabled: true,
//             },
//         });

//         // await order.save();
//         return response.send({
//             error: false,
//             orderItems: [{
//                 gigID: gig._id,
//                 image: gig.cover,
//                 title: gig.title,
//                 buyerID: request.userID,
//                 sellerID: gig.userID,
//                 price: gig.price,
//                 quantity: 1,
//                 total: gig.price
//             }],
//             totalAmount: gig.price,
//             paymentId: payment_intent.id,
//             clientSecret: payment_intent.client_secret
//         })

//     }
//     catch ({ message, status = 500 }) {
//         return response.send({
//             error: true,
//             message
//         })
//     }
// }

// const createPayment = async (request, response) => {
//     const { cart } = request.body; // Array of gigs with quantity

//     try {
//         if (!cart.length) {
//             throw CustomException("Cart is empty!", 400);
//         }

//         let totalAmount = 0;
//         let orderItems = [];

//         for (const item of cart) {
//             const gig = await Gig.findById(item._id);
//             if (!gig) {
//                 throw CustomException(`Gig with ID ${item.gigID} not found`, 404);
//             }

//             let itemTotal = gig.price * item.quantity;
//             totalAmount += itemTotal;

//             orderItems.push({
//                 gigID: gig._id,
//                 image: gig.cover,
//                 title: gig.title,
//                 buyerID: request.userID,
//                 sellerID: gig.userID,
//                 price: gig.price,
//                 quantity: item.quantity,
//                 total: itemTotal
//             });
//         }

//         // Create a Stripe Payment Intent
//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: totalAmount * 100, // Convert to cents
//             currency: "USD",
//             automatic_payment_methods: { enabled: true },
//         });

//         return response.send({
//             error: false,
//             orderItems,
//             totalAmount,
//             paymentId: paymentIntent.id,
//             clientSecret: paymentIntent.client_secret
//         });

//     } catch ({ message, status = 500 }) {
//         return response.status(status).send({
//             error: true,
//             message
//         });
//     }
// };

const TAX_RATE = 0.045; // 4.5%

const paymentIntent = async (request, response) => {
    const { _id } = request.params;

    try {
        const gig = await Gig.findOne({ _id });
        if (!gig) {
            throw CustomException(`Gig with ID ${_id} not found`, 404);
        }

        let subtotal = gig.price;
        let discountAmount = 0;

        if (request.body.couponCode) {
            const coupon = await Coupon.findOne({ code: request.body.couponCode.trim().toUpperCase() });
            if (coupon && coupon.isActive && new Date(coupon.expiryDate) >= new Date()) {
                discountAmount = parseFloat(((subtotal * coupon.discountPercent) / 100).toFixed(2));
                subtotal -= discountAmount;
            }
        }

        const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
        const totalWithTax = subtotal + taxAmount;

        if (totalWithTax === 0) {
            return response.send({
                error: false,
                orderItems: [{
                    gigID: gig._id,
                    image: gig.cover,
                    title: gig.title,
                    buyerID: request.userID,
                    sellerID: gig.userID,
                    price: gig.price,
                    deliveryTime: gig.deliveryTime,
                    quantity: 1,
                    total: subtotal
                }],
                subtotal,
                taxAmount,
                totalAmount: totalWithTax,
                paymentId: null,
                clientSecret: null,
                skipPayment: true
            });
        }

        const payment_intent = await stripe.paymentIntents.create({
            amount: Math.round(totalWithTax * 100), // cents
            currency: "USD",
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return response.send({
            error: false,
            orderItems: [{
                gigID: gig._id,
                image: gig.cover,
                title: gig.title,
                buyerID: request.userID,
                sellerID: gig.userID,
                price: gig.price,
                deliveryTime: gig.deliveryTime,
                quantity: 1,
                total: subtotal
            }],
            subtotal,
            taxAmount,
            totalAmount: totalWithTax,
            paymentId: payment_intent.id,
            clientSecret: payment_intent.client_secret
        });

    } catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        });
    }
};

const createPayment = async (request, response) => {
    const { cart } = request.body; // Array of gigs with quantity

    try {
        if (!cart.length) {
            throw CustomException("Cart is empty!", 400);
        }

        let subtotal = 0;
        let orderItems = [];

        for (const item of cart) {
            const gig = await Gig.findById(item._id);
            if (!gig) {
                throw CustomException(`Gig with ID ${item.gigID} not found`, 404);
            }

            const itemTotal = gig.price * item.quantity;
            subtotal += itemTotal;

            orderItems.push({
                gigID: gig._id,
                image: gig.cover,
                title: gig.title,
                buyerID: request.userID,
                sellerID: gig.userID,
                price: gig.price,
                deliveryTime: gig.deliveryTime,
                quantity: item.quantity,
                total: itemTotal
            });
        }

        let discountAmount = 0;
        if (request.body.couponCode) {
            const coupon = await Coupon.findOne({ code: request.body.couponCode.trim().toUpperCase() });
            if (coupon && coupon.isActive && new Date(coupon.expiryDate) >= new Date()) {
                discountAmount = parseFloat(((subtotal * coupon.discountPercent) / 100).toFixed(2));
                subtotal -= discountAmount;
            }
        }

        const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
        const totalWithTax = subtotal + taxAmount;

        if (totalWithTax === 0) {
            return response.send({
                error: false,
                orderItems,
                subtotal,
                discountAmount,
                taxAmount,
                totalAmount: totalWithTax,
                paymentId: null,
                clientSecret: null,
                skipPayment: true
            });
        }

        // Create a Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalWithTax * 100), // cents
            currency: "USD",
            automatic_payment_methods: { enabled: true },
        });

        return response.send({
            error: false,
            orderItems,
            subtotal,
            discountAmount,
            taxAmount,
            totalAmount: totalWithTax,
            paymentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret
        });

    } catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        });
    }
};

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const createOrders = async (request, response) => {
    const { orderItems, paymentIntent, totalAmount, couponCode, discountAmount } = request.body;

    try {
        let order_payment_intent = null;
        if (paymentIntent || totalAmount === 0) {
            order_payment_intent = paymentIntent ? paymentIntent.id : "FREE_" + Math.random().toString(36).substring(7);
            const order = new Order({
                buyerID: request.userID,
                gigs: orderItems,
                totalAmount,
                couponCode,
                discountAmount,
                payment_intent: order_payment_intent,
                isCompleted: totalAmount === 0 ? true : false
            });

            await order.save();

            // Fetch buyer info
            const buyer = await User.findById(request.userID);
            const sellerName = await User.findById(orderItems[0].sellerID);
            // const buyer = request.user; // assuming you set request.user from auth middleware
            const buyerName = buyer.username;
            const buyerEmail = buyer.email;

            // Send email to Buyer
            await sendBuyerOrderConfirmationEmail(
                buyerEmail,
                buyerName,
                orderItems.length > 1 ? 'Multiple Gigs' : orderItems[0].title,
                orderItems.length > 1 ? 'Multiple Sellers' : sellerName.username, // fallback if needed
                order._id,
                totalAmount,
                orderItems.length > 1 ? 'Varies by gig' : `${orderItems[0].deliveryTime || 'N/A'}`,
                transporter
            );

            // Send email to each Seller
            for (const gig of orderItems) {
                console.log(gig, "gig details");
                const seller = await User.findById(gig.sellerID); // assuming a User model exists
                if (seller) {
                    await sendSellerOrderNotificationEmail(
                        seller.email,
                        seller.username,
                        gig.title,
                        buyerName,
                        order._id,
                        gig.total,
                        gig.deliveryTime || 'N/A',
                        transporter
                    );
                }
                const orderStatus = new OrderStatus({
                    buyerID: request.userID,
                    sellerID: gig.sellerID,
                    status: "In Progress",
                    orderID: order._id,
                    gigID: gig.gigID
                });

                await orderStatus.save();

                // Create notifications for seller and buyer
                const sellerNotification = await createNotification({
                    userId: gig.sellerID,
                    actorId: request.userID,
                    type: 'order.placed',
                    title: 'New order received',
                    body: `${buyerName} ordered ${gig.title}`,
                    metadata: { orderId: order._id, gigId: gig.gigID }
                });
                emitToUser(gig.sellerID.toString(), 'notification:new', {
                    id: sellerNotification._id,
                    type: sellerNotification.type,
                    title: sellerNotification.title,
                    body: sellerNotification.body,
                    metadata: sellerNotification.metadata,
                    createdAt: sellerNotification.createdAt
                });
            }

            // Notify buyer as well
            const buyerNotification = await createNotification({
                userId: request.userID,
                actorId: request.userID,
                type: 'order.placed',
                title: 'Order placed successfully',
                body: `Your order ${order._id} has been created`,
                metadata: { orderId: order._id }
            });
            emitToUser(request.userID.toString(), 'notification:new', {
                id: buyerNotification._id,
                type: buyerNotification.type,
                title: buyerNotification.title,
                body: buyerNotification.body,
                metadata: buyerNotification.metadata,
                createdAt: buyerNotification.createdAt
            });
        }

        return response.send({
            error: false,
            message: "Congratulations! Payment got successful.",
            payment_intent: order_payment_intent
        });

    } catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        });
    }
};

const updateOrderStatus = async (req, res) => {
    const { buyerID, sellerID, status, orderID, gigID, conversationID } = req.body;

    try {
        // Fetch related gig with buyer and seller populated
        const gigFound = await Gig.findById({ _id: gigID }).populate('userID');
        if (!gigFound) {
            return res.status(404).send({ error: true, message: 'Gig not found.' });
        }

        const user = await User.findById(req.userID);
        const buyer = await User.findById(buyerID);
        const seller = await User.findById(sellerID);
        
        if (!buyer || !seller) {
            return res.status(404).send({ error: true, message: 'Buyer or seller not found.' });
        }

        // Update status
        let orderStatus;
        if (status === "Revision Requested") {
            orderStatus = new OrderStatus({
                buyerID: buyerID,
                sellerID: sellerID,
                status: status,
                orderID: orderID,
                gigID: gigID
            });
            orderStatus.revisionRequestedCount += 1;
        } else {
            orderStatus = new OrderStatus({
                buyerID: buyerID,
                sellerID: sellerID,
                status: status,
                orderID: orderID,
                gigID: gigID
            });
        }
        await orderStatus.save();

        // Create real-time + stored notification for counterparty
        try {
            const receiverId = req.userID.toString() === buyerID.toString() ? sellerID : buyerID;
            const receiver = await User.findById(receiverId);
            const title = `Order status: ${status}`;
            const body = `${user?.username || 'User'} updated status to "${status}" for ${gigFound.title}`;
            console.log(receiver, title, "title");
            const notif = await createNotification({
                userId: receiverId,
                actorId: req.userID,
                type: `order.status.${status.replace(/\s+/g, '_').toLowerCase()}`,
                title,
                body,
                metadata: { orderId: orderID, gigId: gigID, status, conversationID }
            });
            
            // Emit real-time notification to counterparty
            emitToUser(receiverId.toString(), 'notification:new', {
                id: notif._id,
                type: notif.type,
                title: notif.title,
                body: notif.body,
                metadata: notif.metadata,
                createdAt: notif.createdAt
            });

            // Send email notification to counterparty
            await sendOrderStatusEmail(
                user,
                receiver,
                gigFound.title,
                status,
                orderID
            );

        } catch (e) {
            console.error('Error creating notification:', e);
            // Continue execution even if notification fails
        }

        return res.send({
            error: false,
            message: "Order status updated successfully."
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).send({
            error: true,
            message: error.message || 'Internal server error.'
        });
    }
};

const updatePaymentStatus = async (request, response) => {
    const { payment_intent } = request.body;

    try {
        const order = await Order.findOneAndUpdate(
            { payment_intent },
            { $set: { isCompleted: true } },
            { new: true }
        );

        if (order?.isCompleted) {
            return response.status(202).send({
                error: false,
                message: 'Order has been confirmed!'
            });
        }

        throw CustomException('Payment status not updated!', 500);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        });
    }
};

// GET /orders/withdrawals
const getWithdrawals = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user.isSeller) {
            return res.status(403).send({ error: true, message: 'Only sellers can view withdrawals.' });
        }
        const withdrawals = await Withdrawal.find({ sellerID: user._id })
            .populate('sellerID', 'fullname username email image country state postalCode address phone').sort({ createdAt: -1 });
        return res.send({ error: false, withdrawals });
    } catch (error) {
        return res.status(500).send({ error: true, message: error.message || 'Internal server error.' });
    }
};

// GET /orders/admin/withdrawals
const adminGetWithdrawals = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user || user.role !== "admin") {
            return res.status(403).send({
                error: true,
                message: "Only admin can view all withdrawals."
            });
        }

        const withdrawals = await Withdrawal.find()
            .populate('sellerID', 'fullname username email image country state postalCode address phone')
            .sort({ createdAt: -1 });

        return res.send({ error: false, withdrawals });
    } catch (error) {
        return res.status(500).send({
            error: true,
            message: error.message || "Internal server error."
        });
    }
};

// GET /orders/withdrawals/:id
const getWithdrawalById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userID;

        if (!id) {
            return res.status(400).send({ error: true, message: 'Withdrawal ID is required.' });
        }

        // Find withdrawal by ID and populate seller details
        const withdrawal = await Withdrawal.findById(id)
            .populate('sellerID', 'fullname username email image country fullname address postalCode state phone isSeller createdAt');

        if (!withdrawal) {
            return res.status(404).send({ error: true, message: 'Withdrawal not found.' });
        }

        // Check access permissions
        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).send({ error: true, message: 'Unauthorized: user not found.' });
        }

        const isAdmin = user.role === "admin";
        const isSeller = user.isSeller && withdrawal.sellerID._id.toString() === userId.toString();

        if (!isAdmin && !isSeller) {
            return res.status(403).send({ error: true, message: 'Access denied. You can only view your own withdrawals.' });
        }

        // Return withdrawal with seller details and account details
        const withdrawalDetails = {
            ...withdrawal.toObject(),
            seller: withdrawal.sellerID,
            accountDetails: {
                accountHolderName: withdrawal.accountHolderName,
                routingNumber: withdrawal.routingNumber,
                accountNumber: withdrawal.accountNumber,
                accountType: withdrawal.accountType,
                country: withdrawal.country
            }
        };

        return res.send({ error: false, withdrawal: withdrawalDetails });
    } catch (error) {
        console.error('Error fetching withdrawal by ID:', error);
        return res.status(500).send({
            error: true,
            message: error.message || 'Internal server error.'
        });
    }
};

const getAdminDashboardCounts = async (req, res) => {
    try {
        // Ensure only admin can access
        const requester = await User.findById(req.userID);
        if (!requester || requester.role !== 'admin') {
            return res.status(403).send({ error: true, message: 'Forbidden: admin role required.' });
        }

        const totalUsers = await User.countDocuments({ deletedAt: null });
        const totalSellers = await User.countDocuments({ isSeller: true, deletedAt: null });
        const totalBuyers = totalUsers - totalSellers;
        const ordersCount = await Order.countDocuments({ deletedAt: null });
        const activeGigs = await Gig.countDocuments({ deletedAt: null });

        const revenueAgg = await Order.aggregate([
            { $match: { deletedAt: null, isCompleted: true } },
            { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
        ]);
        const totalRevenue = revenueAgg.length ? revenueAgg[0].totalRevenue : 0;

        return res.send({ error: false, data: { totalUsers, totalSellers, totalBuyers, ordersCount, activeGigs, totalRevenue } });
    } catch (error) {
        console.error('getDashboardCounts error:', error);
        return res.status(500).send({ error: true, message: error.message || 'Internal server error.' });
    }
};

// GET /orders/withdrawals/:id
const updateWithdrawalStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userID;

        if (!id) {
            return res.status(400).send({ error: true, message: 'Withdrawal ID is required.' });
        }

        // Find withdrawal by ID and populate seller details
        const withdrawal = await Withdrawal.findById(id)
            .populate('sellerID', 'fullname username email image country fullname address postalCode state phone isSeller createdAt');

        if (!withdrawal) {
            return res.status(404).send({ error: true, message: 'Withdrawal not found.' });
        }

        // Store old status before updating
        const oldStatus = withdrawal.status;

        // Check access permissions before updating
        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).send({ error: true, message: 'Unauthorized: user not found.' });
        }

        const isAdmin = user.role === "admin";
        const isSeller = user.isSeller && withdrawal.sellerID._id.toString() === userId.toString();

        if (!isAdmin && !isSeller) {
            return res.status(403).send({ error: true, message: 'Access denied. You can only view your own withdrawals.' });
        }

        // Update status to completed
        withdrawal.status = "completed";
        await withdrawal.save();

        // Send notification & email to seller if admin changed status to completed
        if (isAdmin && oldStatus !== "completed" && withdrawal.status === "completed") {
            try {
                const sellerNotification = await createNotification({
                    userId: withdrawal.sellerID._id,
                    actorId: userId,
                    type: 'withdrawal.status.completed',
                    title: 'Withdrawal Payment Completed',
                    body: `Your withdrawal request of $${withdrawal.amount || 'N/A'} has been processed and completed.`,
                    metadata: { 
                        withdrawalId: withdrawal._id, 
                        amount: withdrawal.amount,
                        status: withdrawal.status
                    }
                });

                // Emit real-time notification to seller
                emitToUser(withdrawal.sellerID._id.toString(), 'notification:new', {
                    id: sellerNotification._id,
                    type: sellerNotification.type,
                    title: sellerNotification.title,
                    body: sellerNotification.body,
                    metadata: sellerNotification.metadata,
                    createdAt: sellerNotification.createdAt
                });

                // Send email notification to seller about withdrawal completion
                if (withdrawal.sellerID && withdrawal.sellerID.email) {
                    await sendSellerWithdrawalStatusUpdateEmail(
                        withdrawal.sellerID.email,
                        withdrawal.sellerID.fullname || withdrawal.sellerID.username || 'Seller',
                        withdrawal.amount,
                        'Approved', // Email template expects 'Approved' or 'Rejected'
                        new Date(),
                        transporter
                    );
                }
            } catch (notifError) {
                console.error('Error sending withdrawal notification/email:', notifError);
                // Continue execution even if notification fails
            }
        }

        // Return withdrawal with seller details and account details
        const withdrawalDetails = {
            ...withdrawal.toObject(),
            seller: withdrawal.sellerID,
            accountDetails: {
                accountHolderName: withdrawal.accountHolderName,
                routingNumber: withdrawal.routingNumber,
                accountNumber: withdrawal.accountNumber,
                accountType: withdrawal.accountType,
                country: withdrawal.country
            }
        };

        return res.send({ error: false, withdrawal: withdrawalDetails });
    } catch (error) {
        console.error('Error fetching withdrawal by ID:', error);
        return res.status(500).send({
            error: true,
            message: error.message || 'Internal server error.'
        });
    }
};

// Update getEarningStats to only count available funds as not withdrawn
const getEarningStats = async (request, response) => {
    try {
        const user = await User.findById(request.userID);
        if (!user.isSeller) {
            return response.status(403).send({ error: true, message: 'Only sellers can view earnings stats.' });
        }

        // 1. Find all OrderStatus for this seller
        const orderStatuses = await OrderStatus.find({ sellerID: user._id, deletedAt: null });

        // 2. Group by orderID+gigID to get latest status for each gig in each order
        const latestStatusMap = {};
        orderStatuses.forEach(status => {
            const key = `${status.orderID}_${status.gigID}`;
            if (!latestStatusMap[key] || new Date(status.createdAt) > new Date(latestStatusMap[key].createdAt)) {
                latestStatusMap[key] = status;
            }
        });

        // // 3. For each, get the corresponding order and gig info for price
        // let availableFunds = 0;
        // let futurePayments = 0;
        // let totalEarnings = 0;

        // // We'll need to fetch all relevant orders in one go for efficiency
        // const orderIDs = Array.from(new Set(Object.values(latestStatusMap).map(s => s.orderID)));
        // const orders = await Order.find({ _id: { $in: orderIDs } });
        // const orderMap = {};
        // orders.forEach(order => { orderMap[order._id.toString()] = order; });

        // Object.values(latestStatusMap).forEach(status => {
        //     const order = orderMap[status.orderID?.toString()];
        //     if (!order) return;
        //     // Find the gig in the order's gigs array
        //     const gigItem = order.gigs.find(g => g.gigID.toString() === status.gigID.toString() && g.sellerID.toString() === user._id.toString());
        //     if (!gigItem) return;
        //     const amount = gigItem.total || gigItem.price || 0;

        //     if (status.status === 'Completed' && !status.withdrawn) {
        //         availableFunds += amount;
        //         totalEarnings += amount;
        //     } else if (status.status !== "Canceled" && status.status !== "Completed") {
        //         futurePayments += amount;
        //     }
        // });

        // return response.send({
        //     availableFunds,
        //     futurePayments,
        //     totalEarnings
        // });
        
        let availableFunds = 0;
        let futurePayments = 0;
        let totalEarnings = 0;

        const availableStatuses = [];
        const futureStatuses = [];
        const totalEarningStatuses = [];

        // Fetch all relevant orders
        const orderIDs = Array.from(new Set(Object.values(latestStatusMap).map(s => s.orderID)));
        const orders = await Order.find({ _id: { $in: orderIDs } });
        const orderMap = {};
        orders.forEach(order => { orderMap[order._id.toString()] = order; });

        Object.values(latestStatusMap).forEach(status => {
            const order = orderMap[status.orderID?.toString()];
            if (!order) return;

            const gigItem = order.gigs.find(g =>
                g.gigID.toString() === status.gigID.toString() &&
                g.sellerID.toString() === user._id.toString()
            );
            if (!gigItem) return;

            const amount = order.totalAmount || 0;
            const statusEntry = {
                ...status._doc,
                status: status.status,
                amount,
                withdrawn: status.withdrawn,
                gigID: status.gigID,
                orderID: status.orderID
            };

            // Accumulate amounts and group statuses
            if (status.status === 'Completed') {
                totalEarnings += amount;
                totalEarningStatuses.push(statusEntry);
            }
            if (status.status === 'Completed' && !status.withdrawn) {
                availableFunds += amount;
                availableStatuses.push(statusEntry);
            }
            if (status.status !== "Canceled" && status.status !== "Completed") {
                futurePayments += amount;
                futureStatuses.push(statusEntry);
            }
        });

        // Return the response in the requested format
        return response.send([
            { availableFunds, statuses: availableStatuses },
            { futurePayments, statuses: futureStatuses },
            { totalEarnings, statuses: totalEarningStatuses }
        ]);
    } catch (error) {
        return response.status(500).send({
            error: true,
            message: error.message || 'Internal server error.'
        });
    }
};
// PATCH /orders/:id/:gigID
// Buyer can update deliveryDate
// Seller can only request extension (sets status = "Extend Delivery Date")
const updateOrderDetails = async (req, res) => {
    try {
        const { id, gigID } = req.params;
        const { deliveryDate } = req.body;

        if (!id) {
            return res.status(400).send({ error: true, message: 'Order id is required.' });
        }

        const order = await Order.findById(id)
            .populate('buyerID', '_id username email')
            .populate('gigs.sellerID', '_id username email');

        if (!order) {
            return res.status(404).send({ error: true, message: 'Order not found.' });
        }

        // ✅ Load current user and check role
        const user = await User.findById(req.userID);
        if (!user) {
            return res.status(401).send({ error: true, message: 'Unauthorized: user not found.' });
        }

        const userId = user._id.toString();
        const isBuyer = order.buyerID?._id?.toString() === userId;

        // --- CASE 2: Buyer updates deliveryDate ---
        if (isBuyer && deliveryDate) {
            const parsed = new Date(deliveryDate);
            if (isNaN(parsed.getTime())) {
                return res.status(400).send({ error: true, message: 'Invalid deliveryDate. Expect ISO date string.' });
            }

            order.deliveryDate = parsed;
            await order.save();
            const formattedDate = parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

            // Notify + Email buyer (optional self-notification)
            const buyerNotif = await createNotification({
                userId: order.buyerID._id,
                actorId: userId,
                type: `order.status.delivery_updated`,
                title: `Order status: Delivery Updated`,
                body: `${user.username || 'Buyer'} updated delivery date to ${formattedDate}`,
                metadata: { orderId: order._id, deliveryDate: order.deliveryDate }
            });
            emitToUser(order.buyerID._id.toString(), 'notification:new', {
                id: buyerNotif._id,
                type: buyerNotif.type,
                title: buyerNotif.title,
                body: buyerNotif.body,
                metadata: buyerNotif.metadata,
                createdAt: buyerNotif.createdAt
            });

            await sendOrderStatusEmail(user, order.buyerID, 'Order Updated', 'Delivery Date Updated', order._id);

            // Notify + Email each seller
            const uniqueSellers = Array.from(new Set(order.gigs.map(g => g.sellerID?._id?.toString()).filter(Boolean)));
            for (const sellerId of uniqueSellers) {
                const seller = order.gigs.find(g => g?.sellerID?._id?.toString() === sellerId)?.sellerID;
                if (!seller) continue;

                const sellerNotif = await createNotification({
                    userId: seller._id,
                    actorId: userId,
                    type: `order.status.delivery_updated`,
                    title: `Order status: Delivery Updated`,
                    body: `${user.username || 'Buyer'} updated delivery date to ${formattedDate}`,
                    metadata: { orderId: order._id, deliveryDate: order.deliveryDate }
                });
                emitToUser(seller._id.toString(), 'notification:new', {
                    id: sellerNotif._id,
                    type: sellerNotif.type,
                    title: sellerNotif.title,
                    body: sellerNotif.body,
                    metadata: sellerNotif.metadata,
                    createdAt: sellerNotif.createdAt
                });

                await sendOrderStatusEmail(user, seller, 'Order Updated', 'Delivery Date Updated', order._id);
                
                const orderStatus = new OrderStatus({
                    buyerID: req.userID,
                    sellerID: seller._id,
                    status: "In Progress",
                    orderID: order._id,
                    gigID: gigID
                });

                await orderStatus.save();
            }

            return res.send({ error: false, message: 'Delivery date updated.', order });
        }

        return res.status(403).send({ error: true, message: 'Not authorized for this action.' });

    } catch (error) {
        console.error('updateOrderDetails error:', error);
        return res.status(500).send({ error: true, message: error.message || 'Internal server error.' });
    }
};

// Extend Delivery Request - Seller requests extension
const requestExtendDelivery = async (req, res) => {
    try {
        const { orderId, gigId, conversationID, days, currentDeliveryDate } = req.body;
        const sellerId = req.userID;

        if (!orderId || !gigId || !days || !currentDeliveryDate) {
            return res.status(400).send({ 
                error: true, 
                message: 'Order ID, Gig ID, days, and current delivery date are required.' 
            });
        }

        // Verify the order exists and seller has access
        const order = await Order.findById(orderId)
            .populate('buyerID', 'username email')
            .populate('gigs.sellerID', 'username email');

        if (!order) {
            return res.status(404).send({ error: true, message: 'Order not found.' });
        }

        // Check if seller has access to this order
        const hasAccess = order.gigs.some(gig => 
            gig.sellerID._id.toString() === sellerId && gig.gigID.toString() === gigId
        );

        if (!hasAccess) {
            return res.status(403).send({ error: true, message: 'Access denied.' });
        }

        // Calculate new delivery date
        const newDeliveryDate = new Date(currentDeliveryDate);
        newDeliveryDate.setDate(newDeliveryDate.getDate() + parseInt(days));

        // Create extend delivery request data
        const extendRequest = {
            orderId,
            gigId,
            sellerId,
            buyerId: order.buyerID._id,
            days: parseInt(days),
            currentDeliveryDate: new Date(currentDeliveryDate),
            newDeliveryDate,
            status: 'pending',
            requestedAt: new Date()
        };

        // Create order status with extend request
        const orderStatus = new OrderStatus({
            buyerID: order.buyerID._id,
            sellerID: sellerId,
            status: "Extend Delivery Date Requested",
            orderID: orderId,
            gigID: gigId,
            extendRequest: extendRequest
        });

        await orderStatus.save();

        // Get seller info
        const seller = await User.findById(sellerId);
        const gig = await Gig.findById(gigId);

        // Create notification for buyer
        const buyerNotification = await createNotification({
            userId: order.buyerID._id,
            actorId: sellerId,
            type: 'order.extend_delivery_request',
            title: 'Delivery Extension Request',
            body: `${seller.username} requested to extend delivery by ${days} day${days > 1 ? 's' : ''} for "${gig.title}"`,
            metadata: { 
                orderId, 
                gigId, 
                extendRequest,
                type: 'extend_delivery_request'
            }
        });

        // Emit real-time notification to buyer
        emitToUser(order.buyerID._id.toString(), 'notification:new', {
            id: buyerNotification._id,
            type: buyerNotification.type,
            title: buyerNotification.title,
            body: buyerNotification.body,
            metadata: buyerNotification.metadata,
            createdAt: buyerNotification.createdAt
        });

        // Send email to buyer
        await sendExtendDeliveryRequestEmail(
            order.buyerID.email,
            order.buyerID.username,
            seller.username,
            gig.title,
            orderId,
            gigId,
            conversationID,
            days,
            currentDeliveryDate,
            newDeliveryDate,
            transporter
        );

        return res.send({ 
            error: false, 
            message: 'Extend delivery request sent successfully.',
            extendRequest
        });

    } catch (error) {
        console.error('Error requesting extend delivery:', error);
        return res.status(500).send({ 
            error: true, 
            message: error.message || 'Internal server error.' 
        });
    }
};

// Approve Extend Delivery Request - Buyer approves extension
const approveExtendDelivery = async (req, res) => {
    try {
        const { orderId, gigId, conversationID } = req.body;
        const buyerId = req.userID;

        if (!orderId || !gigId) {
            return res.status(400).send({ 
                error: true, 
                message: 'Order ID and Gig ID are required.' 
            });
        }

        // Find the latest order status with pending extend request
        const orderStatus = await OrderStatus.findOne({
            orderID: orderId,
            gigID: gigId,
            status: "Extend Delivery Date Requested",
            'extendRequest.status': 'pending'
        }).sort({ createdAt: -1 });

        if (!orderStatus || !orderStatus.extendRequest) {
            return res.status(404).send({ 
                error: true, 
                message: 'No pending extend delivery request found.' 
            });
        }

        // Verify buyer has access
        if (orderStatus.buyerID.toString() !== buyerId) {
            return res.status(403).send({ error: true, message: 'Access denied.' });
        }

        const extendRequest = orderStatus.extendRequest;
        const newDeliveryDate = extendRequest.newDeliveryDate;

        // Update order delivery date
        await Order.findByIdAndUpdate(orderId, {
            deliveryDate: newDeliveryDate
        });

        // Create new order status with approved extend request
        const approvedOrderStatus = new OrderStatus({
            buyerID: buyerId,
            sellerID: orderStatus.sellerID,
            status: "In Progress",
            orderID: orderId,
            gigID: gigId,
            extendRequest: {
                ...extendRequest,
                status: 'approved',
                approvedAt: new Date()
            }
        });

        await approvedOrderStatus.save();

        // Get user info
        const buyer = await User.findById(buyerId);
        const seller = await User.findById(orderStatus.sellerID);
        const gig = await Gig.findById(gigId);

        // Create notification for seller
        const sellerNotification = await createNotification({
            userId: orderStatus.sellerID,
            actorId: buyerId,
            type: 'order.extend_delivery_approved',
            title: 'Delivery Extension Approved',
            body: `${buyer.username} approved your delivery extension request for "${gig.title}"`,
            metadata: { 
                orderId, 
                gigId, 
                extendRequest: approvedOrderStatus.extendRequest,
                type: 'extend_delivery_approved'
            }
        });

        // Emit real-time notification to seller
        emitToUser(orderStatus.sellerID.toString(), 'notification:new', {
            id: sellerNotification._id,
            type: sellerNotification.type,
            title: sellerNotification.title,
            body: sellerNotification.body,
            metadata: sellerNotification.metadata,
            createdAt: sellerNotification.createdAt
        });

        // Send email to seller
        await sendExtendDeliveryApprovalEmail(
            seller.email,
            seller.username,
            buyer.username,
            gig.title,
            orderId,
            gigId,
            conversationID,
            extendRequest.days,
            newDeliveryDate,
            transporter
        );

        return res.send({ 
            error: false, 
            message: 'Delivery extension approved successfully.',
            newDeliveryDate
        });

    } catch (error) {
        console.error('Error approving extend delivery:', error);
        return res.status(500).send({ 
            error: true, 
            message: error.message || 'Internal server error.' 
        });
    }
};

// Reject Extend Delivery Request - Buyer rejects extension
const rejectExtendDelivery = async (req, res) => {
    try {
        const { orderId, gigId, conversationID } = req.body;
        const buyerId = req.userID;

        if (!orderId || !gigId) {
            return res.status(400).send({ 
                error: true, 
                message: 'Order ID and Gig ID are required.' 
            });
        }

        // Find the latest order status with pending extend request
        const orderStatus = await OrderStatus.findOne({
            orderID: orderId,
            gigID: gigId,
            status: "Extend Delivery Date Requested",
            'extendRequest.status': 'pending'
        }).sort({ createdAt: -1 });

        if (!orderStatus || !orderStatus.extendRequest) {
            return res.status(404).send({ 
                error: true, 
                message: 'No pending extend delivery request found.' 
            });
        }

        // Verify buyer has access
        if (orderStatus.buyerID.toString() !== buyerId) {
            return res.status(403).send({ error: true, message: 'Access denied.' });
        }

        const extendRequest = orderStatus.extendRequest;

        // Create new order status with rejected extend request
        const rejectedOrderStatus = new OrderStatus({
            buyerID: buyerId,
            sellerID: orderStatus.sellerID,
            status: "In Progress",
            orderID: orderId,
            gigID: gigId,
            extendRequest: {
                ...extendRequest,
                status: 'rejected',
                rejectedAt: new Date()
            }
        });

        await rejectedOrderStatus.save();

        // Get user info
        const buyer = await User.findById(buyerId);
        const seller = await User.findById(orderStatus.sellerID);
        const gig = await Gig.findById(gigId);

        // Create notification for seller
        const sellerNotification = await createNotification({
            userId: orderStatus.sellerID,
            actorId: buyerId,
            type: 'order.extend_delivery_rejected',
            title: 'Delivery Extension Rejected',
            body: `${buyer.username} rejected your delivery extension request for "${gig.title}"`,
            metadata: { 
                orderId, 
                gigId, 
                extendRequest: rejectedOrderStatus.extendRequest,
                type: 'extend_delivery_rejected'
            }
        });

        // Emit real-time notification to seller
        emitToUser(orderStatus.sellerID.toString(), 'notification:new', {
            id: sellerNotification._id,
            type: sellerNotification.type,
            title: sellerNotification.title,
            body: sellerNotification.body,
            metadata: sellerNotification.metadata,
            createdAt: sellerNotification.createdAt
        });

        // Send email to seller
        await sendExtendDeliveryRejectionEmail(
            seller.email,
            seller.username,
            buyer.username,
            gig.title,
            orderId, gigId, conversationID,
            extendRequest.days,
            extendRequest.currentDeliveryDate,
            transporter
        );

        return res.send({ 
            error: false, 
            message: 'Delivery extension rejected successfully.'
        });

    } catch (error) {
        console.error('Error rejecting extend delivery:', error);
        return res.status(500).send({ 
            error: true, 
            message: error.message || 'Internal server error.' 
        });
    }
};

module.exports = {
    getOrders, getOrderDetailsById, paymentIntent, createPayment, createOrders, updateOrderStatus,
    updatePaymentStatus, getWithdrawals, getEarningStats, updateOrderDetails,
    requestExtendDelivery, approveExtendDelivery, rejectExtendDelivery, adminGetWithdrawals, getWithdrawalById,
    updateWithdrawalStatus, getAdminDashboardCounts
}

