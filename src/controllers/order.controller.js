const { Order, Gig, User, OrderStatus, Withdrawal } = require('../models');
const { CustomException } = require('../utils');
const {
    sendBuyerOrderConfirmationEmail,
    sendSellerOrderNotificationEmail,
    sendSellerWithdrawalStatusUpdateEmail,
    sendExtendDeliveryRequestEmail,
    sendExtendDeliveryApprovalEmail,
    sendExtendDeliveryRejectionEmail
} = require('../utils/emailTemplates');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const crypto = require('node:crypto');
const { sendOrderStatusEmail } = require('../utils/sendOrderStatusEmail');
const { notifyAndEmit } = require('../utils/notifyAndEmit');
const { mailTransporter: transporter } = require('../utils/mailTransporter');
const { getDashboardCounts: getAdminDashboardCounts } = require('./admin.controller');
const {
    WITHDRAWAL_SELLER_POPULATE,
    toDisplayText,
    toSafeObjectId,
    applyCouponDiscount,
    calculateTaxTotals,
    buildOrderItemFromGig,
    formatWithdrawalDetails,
    assertAdmin,
    assertWithdrawalAccess,
    createOrderStatusEntry,
    findPendingExtendRequest
} = require('../utils/orderHelpers');

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

        const updatedOrders = orders.map(item => {
            if (item._doc.buyerID?._id.toString() === request.userID) {
                return item._doc;
            }
            return {
                ...item._doc,
                gigs: item._doc.gigs.filter(gig => gig._doc.sellerID?._id.toString() === request.userID)
            };
        });

        const orderIDs = updatedOrders.map(order => order._id);
        const orderStatuses = await OrderStatus.find({
            orderID: { $in: orderIDs }
        })
            .populate('buyerID', 'username fullname email image country')
            .populate('sellerID', 'username fullname email image country')
            .populate('gigID', 'title price')
            .lean();

        const statusesMap = {};
        orderStatuses.forEach(status => {
            const key = status.orderID.toString();
            if (!statusesMap[key]) statusesMap[key] = [];
            statusesMap[key].push(status);
        });

        const enrichedOrders = updatedOrders.map(order => {
            const statuses = statusesMap[order._id.toString()] || [];
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
    } catch (error) {
        return response.status(500).send({
            error: true,
            message: error.message
        });
    }
};

const getOrderDetailsById = async (request, response) => {
    try {
        const { id, gig_id } = request.params;

        const order = await Order.findById(id)
            .populate('buyerID', 'username fullname email image country')
            .populate('gigs.sellerID', 'username fullname email image country isSeller');

        if (!order) {
            return response.status(404).send({ error: true, message: 'Order not found' });
        }

        const userId = request.userID;
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

        const orderStatuses = await OrderStatus.find({
            orderID: order._doc._id,
            deletedAt: null
        }).sort({ createdAt: -1 });
        const currentStatus = await OrderStatus.findOne({
            orderID: order._doc._id,
            deletedAt: null
        }).sort({ createdAt: -1 });

        return response.send({
            ...order._doc,
            gig: gig.toObject(),
            orderStatuses,
            currentStatus
        });
    } catch (err) {
        return response.status(err.status || 500).send({
            error: true,
            message: err.message || 'Server error'
        });
    }
};

const buildPaymentPayload = ({ orderItems, subtotal, discountAmount, taxAmount, totalWithTax, paymentIntentResult }) => {
    const payload = {
        error: false,
        orderItems,
        subtotal,
        taxAmount,
        totalAmount: totalWithTax,
        paymentId: paymentIntentResult?.id ?? null,
        clientSecret: paymentIntentResult?.client_secret ?? null
    };

    if (discountAmount != null) {
        payload.discountAmount = discountAmount;
    }

    if (!paymentIntentResult) {
        payload.skipPayment = true;
    }

    return payload;
};

const createStripePaymentIntent = async (totalWithTax) => {
    if (totalWithTax === 0) {
        return null;
    }

    return stripe.paymentIntents.create({
        amount: Math.round(totalWithTax * 100),
        currency: 'USD',
        automatic_payment_methods: { enabled: true }
    });
};

const paymentIntent = async (request, response) => {
    const { _id } = request.params;

    try {
        const gig = await Gig.findOne({ _id });
        if (!gig) {
            throw CustomException(`Gig with ID ${_id} not found`, 404);
        }

        const { subtotal } = await applyCouponDiscount(gig.price, request.body.couponCode);
        const { taxAmount, totalWithTax } = calculateTaxTotals(subtotal);
        const paymentIntentResult = await createStripePaymentIntent(totalWithTax);

        return response.send(buildPaymentPayload({
            orderItems: [buildOrderItemFromGig(gig, { buyerID: request.userID, quantity: 1, total: subtotal })],
            subtotal,
            taxAmount,
            totalWithTax,
            paymentIntentResult
        }));
    } catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        });
    }
};

const createPayment = async (request, response) => {
    const { cart } = request.body;

    try {
        if (!cart.length) {
            throw CustomException('Cart is empty!', 400);
        }

        let subtotal = 0;
        const orderItems = [];

        for (const item of cart) {
            const gig = await Gig.findById(item._id);
            if (!gig) {
                throw CustomException(`Gig with ID ${item.gigID} not found`, 404);
            }

            const itemTotal = gig.price * item.quantity;
            subtotal += itemTotal;
            orderItems.push(buildOrderItemFromGig(gig, {
                buyerID: request.userID,
                quantity: item.quantity,
                total: itemTotal
            }));
        }

        const discounted = await applyCouponDiscount(subtotal, request.body.couponCode);
        subtotal = discounted.subtotal;
        const { discountAmount } = discounted;
        const { taxAmount, totalWithTax } = calculateTaxTotals(subtotal);
        const paymentIntentResult = await createStripePaymentIntent(totalWithTax);

        return response.send(buildPaymentPayload({
            orderItems,
            subtotal,
            discountAmount,
            taxAmount,
            totalWithTax,
            paymentIntentResult
        }));
    } catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        });
    }
};

const createOrders = async (request, response) => {
    const { orderItems, paymentIntent, totalAmount, couponCode, discountAmount } = request.body;

    try {
        let order_payment_intent = null;
        if (paymentIntent || totalAmount === 0) {
            order_payment_intent = paymentIntent ? paymentIntent.id : 'FREE_' + crypto.randomUUID();
            const order = new Order({
                buyerID: request.userID,
                gigs: orderItems,
                totalAmount,
                couponCode,
                discountAmount,
                payment_intent: order_payment_intent,
                isCompleted: totalAmount === 0
            });

            await order.save();

            const buyer = await User.findById(request.userID);
            const sellerName = await User.findById(orderItems[0].sellerID);
            const buyerName = buyer.username;
            const buyerEmail = buyer.email;

            await sendBuyerOrderConfirmationEmail(
                buyerEmail,
                buyerName,
                orderItems.length > 1 ? 'Multiple Gigs' : orderItems[0].title,
                orderItems.length > 1 ? 'Multiple Sellers' : sellerName.username,
                order._id,
                totalAmount,
                transporter
            );

            for (const gig of orderItems) {
                const seller = await User.findById(gig.sellerID);
                if (seller) {
                    await sendSellerOrderNotificationEmail(
                        seller.email,
                        seller.username,
                        gig.title,
                        buyerName,
                        order._id,
                        gig.total,
                        transporter
                    );
                }

                await createOrderStatusEntry({
                    buyerID: request.userID,
                    sellerID: gig.sellerID,
                    status: 'In Progress',
                    orderID: order._id,
                    gigID: gig.gigID
                });

                await notifyAndEmit({
                    userId: gig.sellerID,
                    actorId: request.userID,
                    type: 'order.placed',
                    title: 'New order received',
                    body: `${buyerName} ordered ${gig.title}`,
                    metadata: { orderId: order._id, gigId: gig.gigID }
                });
            }

            await notifyAndEmit({
                userId: request.userID,
                actorId: request.userID,
                type: 'order.placed',
                title: 'Order placed successfully',
                body: `Your order ${order._id} has been created`,
                metadata: { orderId: order._id }
            });
        }

        return response.send({
            error: false,
            message: 'Congratulations! Payment got successful.',
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

        await createOrderStatusEntry({
            buyerID,
            sellerID,
            status,
            orderID,
            gigID,
            revisionRequestedCount: status === 'Revision Requested' ? 1 : undefined
        });

        try {
            const receiverId = req.userID.toString() === buyerID.toString() ? sellerID : buyerID;
            const receiver = await User.findById(receiverId);
            const title = `Order status: ${status}`;
            const body = `${user?.username || 'User'} updated status to "${status}" for ${toDisplayText(gigFound.title)}`;

            await notifyAndEmit({
                userId: receiverId,
                actorId: req.userID,
                type: `order.status.${status.replace(/\s+/g, '_').toLowerCase()}`,
                title,
                body,
                metadata: { orderId: orderID, gigId: gigID, status, conversationID }
            });

            await sendOrderStatusEmail(
                user,
                receiver,
                gigFound.title,
                status,
                orderID
            );
        } catch (error) {
            console.error('Error creating notification:', error);
        }

        return res.send({
            error: false,
            message: 'Order status updated successfully.'
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
        if (typeof payment_intent !== 'string' || !payment_intent.trim()) {
            throw CustomException('Invalid payment intent!', 400);
        }

        const safePaymentIntent = payment_intent.trim().slice(0, 200);

        const order = await Order.findOneAndUpdate(
            { payment_intent: { $eq: safePaymentIntent } },
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
    } catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        });
    }
};

const getWithdrawals = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user.isSeller) {
            return res.status(403).send({ error: true, message: 'Only sellers can view withdrawals.' });
        }
        const withdrawals = await Withdrawal.find({ sellerID: user._id })
            .populate('sellerID', WITHDRAWAL_SELLER_POPULATE).sort({ createdAt: -1 });
        return res.send({ error: false, withdrawals });
    } catch (error) {
        return res.status(500).send({ error: true, message: error.message || 'Internal server error.' });
    }
};

const adminGetWithdrawals = async (req, res) => {
    try {
        await assertAdmin(req.userID);

        const withdrawals = await Withdrawal.find()
            .populate('sellerID', WITHDRAWAL_SELLER_POPULATE)
            .sort({ createdAt: -1 });

        return res.send({ error: false, withdrawals });
    } catch (error) {
        return res.status(error.status || 500).send({
            error: true,
            message: error.message || 'Internal server error.'
        });
    }
};

const loadWithdrawalForUser = async (id, userId) => {
    if (!id) {
        const error = new Error('Withdrawal ID is required.');
        error.status = 400;
        throw error;
    }

    const withdrawal = await Withdrawal.findById(id)
        .populate('sellerID', WITHDRAWAL_SELLER_POPULATE);

    if (!withdrawal) {
        const error = new Error('Withdrawal not found.');
        error.status = 404;
        throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
        const error = new Error('Unauthorized: user not found.');
        error.status = 401;
        throw error;
    }

    const access = assertWithdrawalAccess(user, withdrawal);
    return { withdrawal, user, ...access };
};

const getWithdrawalById = async (req, res) => {
    try {
        const { withdrawal } = await loadWithdrawalForUser(req.params.id, req.userID);
        return res.send({ error: false, withdrawal: formatWithdrawalDetails(withdrawal) });
    } catch (error) {
        console.error('Error fetching withdrawal by ID:', error);
        return res.status(error.status || 500).send({
            error: true,
            message: error.message || 'Internal server error.'
        });
    }
};

const updateWithdrawalStatus = async (req, res) => {
    try {
        const { withdrawal, isAdmin } = await loadWithdrawalForUser(req.params.id, req.userID);
        const oldStatus = withdrawal.status;

        withdrawal.status = 'completed';
        await withdrawal.save();

        if (isAdmin && oldStatus !== 'completed' && withdrawal.status === 'completed') {
            try {
                await notifyAndEmit({
                    userId: withdrawal.sellerID._id,
                    actorId: req.userID,
                    type: 'withdrawal.status.completed',
                    title: 'Withdrawal Payment Completed',
                    body: `Your withdrawal request of $${withdrawal.amount || 'N/A'} has been processed and completed.`,
                    metadata: {
                        withdrawalId: withdrawal._id,
                        amount: withdrawal.amount,
                        status: withdrawal.status
                    }
                });

                if (withdrawal.sellerID?.email) {
                    await sendSellerWithdrawalStatusUpdateEmail(
                        withdrawal.sellerID.email,
                        withdrawal.sellerID.fullname || withdrawal.sellerID.username || 'Seller',
                        withdrawal.amount,
                        'Approved',
                        new Date(),
                        transporter
                    );
                }
            } catch (notifError) {
                console.error('Error sending withdrawal notification/email:', notifError);
            }
        }

        return res.send({ error: false, withdrawal: formatWithdrawalDetails(withdrawal) });
    } catch (error) {
        console.error('Error updating withdrawal status:', error);
        return res.status(error.status || 500).send({
            error: true,
            message: error.message || 'Internal server error.'
        });
    }
};

const getEarningStats = async (request, response) => {
    try {
        const user = await User.findById(request.userID);
        if (!user.isSeller) {
            return response.status(403).send({ error: true, message: 'Only sellers can view earnings stats.' });
        }

        const orderStatuses = await OrderStatus.find({ sellerID: user._id, deletedAt: null });

        const latestStatusMap = {};
        orderStatuses.forEach(status => {
            const key = `${status.orderID}_${status.gigID}`;
            if (!latestStatusMap[key] || new Date(status.createdAt) > new Date(latestStatusMap[key].createdAt)) {
                latestStatusMap[key] = status;
            }
        });

        let availableFunds = 0;
        let futurePayments = 0;
        let totalEarnings = 0;

        const availableStatuses = [];
        const futureStatuses = [];
        const totalEarningStatuses = [];

        const orderIDs = Array.from(new Set(Object.values(latestStatusMap).map(s => s.orderID)));
        const orders = await Order.find({ _id: { $in: orderIDs } });
        const orderMap = {};
        orders.forEach(order => { orderMap[order._id.toString()] = order; });

        Object.values(latestStatusMap).forEach(status => {
            const order = orderMap[status.orderID?.toString()];
            if (!order) return;

            const hasGig = order.gigs.some(g =>
                g.gigID.toString() === status.gigID.toString() &&
                g.sellerID.toString() === user._id.toString()
            );
            if (!hasGig) return;

            const amount = order.totalAmount || 0;
            const statusEntry = {
                ...status._doc,
                status: status.status,
                amount,
                withdrawn: status.withdrawn,
                gigID: status.gigID,
                orderID: status.orderID
            };

            if (status.status === 'Completed') {
                totalEarnings += amount;
                totalEarningStatuses.push(statusEntry);
            }
            if (status.status === 'Completed' && !status.withdrawn) {
                availableFunds += amount;
                availableStatuses.push(statusEntry);
            }
            if (status.status !== 'Canceled' && status.status !== 'Completed') {
                futurePayments += amount;
                futureStatuses.push(statusEntry);
            }
        });

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

const notifyDeliveryDateUpdate = async ({ user, recipient, order, formattedDate }) => {
    await notifyAndEmit({
        userId: recipient._id,
        actorId: user._id,
        type: 'order.status.delivery_updated',
        title: 'Order status: Delivery Updated',
        body: `${user.username || 'Buyer'} updated delivery date to ${formattedDate}`,
        metadata: { orderId: order._id, deliveryDate: order.deliveryDate }
    });

    await sendOrderStatusEmail(user, recipient, 'Order Updated', 'Delivery Date Updated', order._id);
};

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

        const user = await User.findById(req.userID);
        if (!user) {
            return res.status(401).send({ error: true, message: 'Unauthorized: user not found.' });
        }

        const userId = user._id.toString();
        const isBuyer = order.buyerID?._id?.toString() === userId;

        if (isBuyer && deliveryDate) {
            const parsed = new Date(deliveryDate);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).send({ error: true, message: 'Invalid deliveryDate. Expect ISO date string.' });
            }

            order.deliveryDate = parsed;
            await order.save();
            const formattedDate = parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

            await notifyDeliveryDateUpdate({
                user,
                recipient: order.buyerID,
                order,
                formattedDate
            });

            const uniqueSellers = Array.from(new Set(order.gigs.map(g => g.sellerID?._id?.toString()).filter(Boolean)));
            for (const sellerId of uniqueSellers) {
                const seller = order.gigs.find(g => g?.sellerID?._id?.toString() === sellerId)?.sellerID;
                if (!seller) continue;

                await notifyDeliveryDateUpdate({
                    user,
                    recipient: seller,
                    order,
                    formattedDate
                });

                await createOrderStatusEntry({
                    buyerID: req.userID,
                    sellerID: seller._id,
                    status: 'In Progress',
                    orderID: order._id,
                    gigID
                });
            }

            return res.send({ error: false, message: 'Delivery date updated.', order });
        }

        return res.status(403).send({ error: true, message: 'Not authorized for this action.' });
    } catch (error) {
        console.error('updateOrderDetails error:', error);
        return res.status(500).send({ error: true, message: error.message || 'Internal server error.' });
    }
};

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

        const order = await Order.findById(orderId)
            .populate('buyerID', 'username email')
            .populate('gigs.sellerID', 'username email');

        if (!order) {
            return res.status(404).send({ error: true, message: 'Order not found.' });
        }

        const hasAccess = order.gigs.some(gig =>
            gig.sellerID._id.toString() === sellerId && gig.gigID.toString() === gigId
        );

        if (!hasAccess) {
            return res.status(403).send({ error: true, message: 'Access denied.' });
        }

        const newDeliveryDate = new Date(currentDeliveryDate);
        newDeliveryDate.setDate(newDeliveryDate.getDate() + Number.parseInt(days, 10));

        const extendRequest = {
            orderId,
            gigId,
            sellerId,
            buyerId: order.buyerID._id,
            days: Number.parseInt(days, 10),
            currentDeliveryDate: new Date(currentDeliveryDate),
            newDeliveryDate,
            status: 'pending',
            requestedAt: new Date()
        };

        await createOrderStatusEntry({
            buyerID: order.buyerID._id,
            sellerID: sellerId,
            status: 'Extend Delivery Date Requested',
            orderID: orderId,
            gigID: gigId,
            extendRequest
        });

        const seller = await User.findById(sellerId);
        const gig = await Gig.findById(gigId);

        await notifyAndEmit({
            userId: order.buyerID._id,
            actorId: sellerId,
            type: 'order.extend_delivery_request',
            title: 'Delivery Extension Request',
            body: `${seller.username} requested to extend delivery by ${days} day${days > 1 ? 's' : ''} for "${toDisplayText(gig?.title)}"`,
            metadata: {
                orderId,
                gigId,
                extendRequest,
                type: 'extend_delivery_request'
            }
        });

        await sendExtendDeliveryRequestEmail({
            email: order.buyerID.email,
            buyerName: order.buyerID.username,
            sellerName: seller.username,
            gigTitle: gig.title,
            orderId,
            gigId,
            conversationID,
            days,
            currentDeliveryDate,
            newDeliveryDate,
            transporter
        });

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

const resolveExtendDeliveryDecision = async ({
    orderId,
    gigId,
    conversationID,
    buyerId,
    decision
}) => {
    const safeOrderId = toSafeObjectId(orderId);
    const safeGigId = toSafeObjectId(gigId);

    if (!safeOrderId || !safeGigId) {
        const error = new Error('Order ID and Gig ID are required.');
        error.status = 400;
        throw error;
    }

    const orderStatus = await findPendingExtendRequest(safeOrderId, safeGigId);

    if (!orderStatus?.extendRequest) {
        const error = new Error('No pending extend delivery request found.');
        error.status = 404;
        throw error;
    }

    if (orderStatus.buyerID.toString() !== buyerId) {
        const error = new Error('Access denied.');
        error.status = 403;
        throw error;
    }

    const extendRequest = orderStatus.extendRequest;
    const isApproved = decision === 'approved';
    const resolvedExtendRequest = {
        ...extendRequest,
        status: decision,
        ...(isApproved ? { approvedAt: new Date() } : { rejectedAt: new Date() })
    };

    if (isApproved) {
        await Order.findByIdAndUpdate(safeOrderId, {
            deliveryDate: extendRequest.newDeliveryDate
        });
    }

    const resolvedOrderStatus = await createOrderStatusEntry({
        buyerID: buyerId,
        sellerID: orderStatus.sellerID,
        status: 'In Progress',
        orderID: safeOrderId,
        gigID: safeGigId,
        extendRequest: resolvedExtendRequest
    });

    const buyer = await User.findById(buyerId);
    const seller = await User.findById(orderStatus.sellerID);
    const gig = await Gig.findById(safeGigId);

    await notifyAndEmit({
        userId: orderStatus.sellerID,
        actorId: buyerId,
        type: isApproved ? 'order.extend_delivery_approved' : 'order.extend_delivery_rejected',
        title: isApproved ? 'Delivery Extension Approved' : 'Delivery Extension Rejected',
        body: `${buyer.username} ${isApproved ? 'approved' : 'rejected'} your delivery extension request for "${toDisplayText(gig?.title)}"`,
        metadata: {
            orderId: safeOrderId,
            gigId: safeGigId,
            extendRequest: resolvedOrderStatus.extendRequest,
            type: isApproved ? 'extend_delivery_approved' : 'extend_delivery_rejected'
        }
    });

    if (isApproved) {
        await sendExtendDeliveryApprovalEmail({
            email: seller.email,
            sellerName: seller.username,
            buyerName: buyer.username,
            gigTitle: gig.title,
            orderId: safeOrderId,
            gigId: safeGigId,
            conversationID,
            days: extendRequest.days,
            newDeliveryDate: extendRequest.newDeliveryDate,
            transporter
        });
    } else {
        await sendExtendDeliveryRejectionEmail({
            email: seller.email,
            sellerName: seller.username,
            buyerName: buyer.username,
            gigTitle: gig.title,
            orderId: safeOrderId,
            gigId: safeGigId,
            conversationID,
            days: extendRequest.days,
            currentDeliveryDate: extendRequest.currentDeliveryDate,
            transporter
        });
    }

    return {
        newDeliveryDate: isApproved ? extendRequest.newDeliveryDate : undefined
    };
};

const approveExtendDelivery = async (req, res) => {
    try {
        const { orderId, gigId, conversationID } = req.body;
        const result = await resolveExtendDeliveryDecision({
            orderId,
            gigId,
            conversationID,
            buyerId: req.userID,
            decision: 'approved'
        });

        return res.send({
            error: false,
            message: 'Delivery extension approved successfully.',
            newDeliveryDate: result.newDeliveryDate
        });
    } catch (error) {
        console.error('Error approving extend delivery:', error);
        return res.status(error.status || 500).send({
            error: true,
            message: error.message || 'Internal server error.'
        });
    }
};

const rejectExtendDelivery = async (req, res) => {
    try {
        const { orderId, gigId, conversationID } = req.body;
        await resolveExtendDeliveryDecision({
            orderId,
            gigId,
            conversationID,
            buyerId: req.userID,
            decision: 'rejected'
        });

        return res.send({
            error: false,
            message: 'Delivery extension rejected successfully.'
        });
    } catch (error) {
        console.error('Error rejecting extend delivery:', error);
        return res.status(error.status || 500).send({
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
};
