const { Order, Gig, User, OrderStatus } = require('../models');
const { CustomException } = require('../utils');
const { sendBuyerOrderConfirmationEmail, sendSellerOrderNotificationEmail } = require('../utils/emailTemplates');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const nodemailer = require('nodemailer');

const getOrders = async (request, response) => {
    try {
        const orders = await Order.find({
            $or: [
                { buyerID: request.userID },
                { gigs: { $elemMatch: { sellerID: request.userID } } }
            ]
        })
        .populate('buyerID', 'username email image country')
        .populate('gigs.sellerID', 'username email image country');

        const updatedOrders = orders.map((item, index) => {
            if (item._doc.buyerID._id.toString() === request.userID) {
                return item;
            }
            return {
                ...item._doc,
                gigs: item._doc.gigs.filter((gig, index) => gig._doc.sellerID._id.toString() === request.userID)
            };
        });

        return response.send(updatedOrders);
    }
    catch ({ message, status = 500 }) {
        return response.send({
            error: true,
            message
        })
    }
}

const getOrderDetailsById = async (request, response) => {
    try {
        const { id, gig_id } = request.params;

        // Find order by ID and populate related fields
        const order = await Order.findById(id)
            .populate('buyerID', 'username email image country')
            .populate('gigs.sellerID', 'username email image country');

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
            .populate('userID', 'username country image createdAt email description');

        if (!gig) {
            throw CustomException('Gig not found!', 404);
        }

        // Get all relevant order status entries for this order
        const orderStatuses = await OrderStatus.find({
            orderID: order._doc._id,
            deletedAt: null
        }).lean();

        // Add status to each gig
        const enrichGigsWithStatus = (gig) => {
            // gigs.map(gig => {
                const status = orderStatuses.find(status =>
                    status.gigID?.toString() === gig._id.toString()
                );
                if (status) {
                    return {
                        ...gig.toObject(),
                        status: status ? status.status : 'Unknown'
                    }
                }
                return {
                    ...gig.toObject(),
                };
            // });
        }

        // Filter out gigs not belonging to this seller (if not buyer)
        if (!isBuyer) {
            // const sellerGigs = order.gigs.filter(gig => gig.sellerID._id.toString() === userId);
            // console.log(sellerGigs, "sellerGigs");
            const filteredOrder = {
                ...order._doc,
                gig: enrichGigsWithStatus(gig)
            };
            return response.send(filteredOrder);
        }

        // If buyer, return all gigs enriched
        const fullOrder = {
            ...order._doc,
            gig: enrichGigsWithStatus(gig)
        };

        return response.send(fullOrder);
    } catch (err) {
        return response.status(err.status || 500).send({
            error: true,
            message: err.message || 'Server error'
        });
    }
};

const paymentIntent = async (request, response) => {
    const { _id } = request.params;

    try {
        const gig = await Gig.findOne({ _id });

        const payment_intent = await stripe.paymentIntents.create({
            amount: gig.price * 100,
            currency: "USD",
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // await order.save();
        return response.send({
            error: false,
            orderItems: [{
                gigID: gig._id,
                image: gig.cover,
                title: gig.title,
                buyerID: request.userID,
                sellerID: gig.userID,
                price: gig.price,
                quantity: 1,
                total: gig.price
            }],
            totalAmount: gig.price,
            paymentId: payment_intent.id,
            clientSecret: payment_intent.client_secret
        })

    }
    catch({message, status = 500}) {
        return response.send({
            error: true,
            message
        })
    }
}

const createPayment = async (request, response) => {
    const { cart } = request.body; // Array of gigs with quantity

    try {
        if (!cart.length) {
            throw CustomException("Cart is empty!", 400);
        }

        let totalAmount = 0;
        let orderItems = [];

        for (const item of cart) {
            const gig = await Gig.findById(item._id);
            if (!gig) {
                throw CustomException(`Gig with ID ${item.gigID} not found`, 404);
            }
            
            let itemTotal = gig.price * item.quantity;
            totalAmount += itemTotal;

            orderItems.push({
                gigID: gig._id,
                image: gig.cover,
                title: gig.title,
                buyerID: request.userID,
                sellerID: gig.userID,
                price: gig.price,
                quantity: item.quantity,
                total: itemTotal
            });
        }

        // Create a Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount * 100, // Convert to cents
            currency: "USD",
            automatic_payment_methods: { enabled: true },
        });

        return response.send({
            error: false,
            orderItems,
            totalAmount,
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
            }
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

module.exports = {
    getOrders,
    paymentIntent,
    updatePaymentStatus, createPayment, createOrders, getOrderDetailsById
}
