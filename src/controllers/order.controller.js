const { Order, Gig, User, OrderStatus, Withdrawal } = require('../models');
const { CustomException } = require('../utils');
const { sendBuyerOrderConfirmationEmail, sendSellerOrderNotificationEmail, sendSellerWithdrawalNotificationEmail, sendSellerWithdrawalStatusUpdateEmail } = require('../utils/emailTemplates');
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
            .populate('buyerID', 'username email image country')
            .populate('gigs.sellerID', 'username email image country').sort({ createdAt: -1 });

        // Filter gigs for sellers
        const updatedOrders = orders.map(item => {
            if (item._doc.buyerID._id.toString() === request.userID) {
                return item._doc;
            }
            return {
                ...item._doc,
                gigs: item._doc.gigs.filter(gig => gig._doc.sellerID._id.toString() === request.userID)
            };
        });

        // Fetch relevant OrderStatus documents
        const orderIDs = updatedOrders.map(order => order._id);
        const orderStatuses = await OrderStatus.find({
            orderID: { $in: orderIDs }
        })
            .populate('buyerID', 'username email image country')
            .populate('sellerID', 'username email image country')
            .populate('gigID', 'title price') // adjust fields as needed
            .lean();

        // Group statuses by orderID
        const statusesMap = {};
        orderStatuses.forEach(status => {
            const key = status.orderID.toString();
            if (!statusesMap[key]) statusesMap[key] = [];
            statusesMap[key].push(status);
        });

        // Attach statuses to each order
        const enrichedOrders = updatedOrders.map(order => ({
            ...order,
            orderStatuses: statusesMap[order._id.toString()] || []
        }));

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
            .populate('buyerID', 'username email image country')
            .populate('gigs.sellerID', 'username email image country isSeller');

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
            .populate('userID', 'username country image createdAt email description isSeller');

        if (!gig) {
            throw CustomException('Gig not found!', 404);
        }

        // Get all relevant order status entries for this order
        const orderStatuses = await OrderStatus.find({
            orderID: order._doc._id,
            deletedAt: null
        }).sort({ createdAt: -1 }).lean();
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

        const subtotal = gig.price;
        const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
        const totalWithTax = subtotal + taxAmount;

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

        const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
        const totalWithTax = subtotal + taxAmount;

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
    const { orderItems, paymentIntent, totalAmount } = request.body;

    try {
        if (paymentIntent) {
            const order = new Order({
                buyerID: request.userID,
                gigs: orderItems,
                totalAmount,
                payment_intent: paymentIntent.id
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
            message: "Congratulations! Payment got successful."
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
        const withdrawals = await Withdrawal.find({ sellerID: user._id }).populate('sellerID', 'username email image country').sort({ createdAt: -1 });
        return res.send({ error: false, withdrawals });
    } catch (error) {
        return res.status(500).send({ error: true, message: error.message || 'Internal server error.' });
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

module.exports = {
    getOrders, getOrderDetailsById, paymentIntent, createPayment, createOrders, updateOrderStatus,
    updatePaymentStatus, getWithdrawals, getEarningStats
}

