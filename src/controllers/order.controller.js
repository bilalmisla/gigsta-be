const { Order, Gig } = require('../models');
const { CustomException } = require('../utils');
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const getOrders = async (request, response) => {
    try {
        const orders = await Order.find({ $and: [{ $or: [{ sellerID: request.userID }, { buyerID: request.userID }] }, { isCompleted: true }] }).populate(request.isSeller? 'buyerID' : 'sellerID', 'username email image country');
        return response.send(orders);
    }
    catch ({ message, status = 500 }) {
        return response.send({
            error: true,
            message
        })
    }
}

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

        const order = new Order({
            gigID: gig._id,
            image: gig.cover,
            title: gig.title,
            buyerID: request.userID,
            sellerID: gig.userID,
            price: gig.price,
            payment_intent: payment_intent.id
        });

        await order.save();
        return response.send({
            error: false,
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

const checkout = async (request, response) => {
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

        // Save the order to the database
        const order = new Order({
            buyerID: request.userID,
            gigs: orderItems,
            totalAmount,
            payment_intent: paymentIntent.id
        });

        await order.save();

        return response.send({
            error: false,
            clientSecret: paymentIntent.client_secret
        });

    } catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        });
    }
};

// const updatePaymentStatus = async (request, response) => {
//     const { payment_intent } = request.body;

//     try {
//         const order = await Order.findOneAndUpdate({ payment_intent }, {
//             $set: {
//                 isCompleted: true
//             }
//         }, { new: true });

//         if(order?.isCompleted) {
//             return response.status(202).send({
//                 error: false,
//                 message: 'Order has been confirmed!'
//             })
//         }

//         throw CustomException('Payment status not updated!', 500);
//     }
//     catch({message, status = 500}) {
//         return response.status(status).send({
//             error: true,
//             message
//         })
//     }
// }
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
    updatePaymentStatus, checkout
}