const { default: mongoose } = require('mongoose');
const { User, Order, Withdrawal, OrderStatus, PaymentMethod } = require('../models');
const { CustomException } = require('../utils');
const calculateSellerAvailableFunds = require('../utils/calculateSellerAvailableFunds');
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const deleteUser = async (request, response) => {
    const { _id } = request.params;

    try {
        const user = await User.findOne({ _id });

        if(request.userID === user._id.toString()) {
            await User.deleteOne({ _id });
            return response.send({
                error: false,
                message: 'Account successfully deleted!'
            });
        }

        throw CustomException('Invalid request!. Cannot delete other user accounts.', 403);
    }
    catch({message, status = 500}) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const fetchTopSellers = async (request, response) => {
    try {
        const topSellers = await Order.aggregate([
            { $match: { deletedAt: null } }, // Ignore soft-deleted orders
            { $unwind: "$gigs" },
            {
                $group: {
                    _id: "$gigs.sellerID",
                    totalOrders: { $sum: 1 }
                }
            },
            { $sort: { totalOrders: -1 } },
            { $limit: 10 }, // Optional: top 10 sellers
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "seller"
                }
            },
            { $unwind: "$seller" },
            {
                $match: {
                    "seller.isSeller": true,
                    "seller.isVerified": true,
                    "seller.deletedAt": null
                }
            },
            {
                $project: {
                    _id: 0,
                    sellerID: "$_id",
                    totalOrders: 1,
                    username: "$seller.username",
                    email: "$seller.email",
                    country: "$seller.country",
                    image: "$seller.image",
                    description: "$seller.description"
                }
            }
        ]);


        return response.send({
            error: false,
            success: true,
            data: topSellers,
            message: 'Top sellers fetched successfully.'
        });
    } catch (error) {
        const { message, status = 500 } = error;
        return response.status(status).send({
            error: true,
            success: false,
            message
        });
    }
};

const createStripeAccountLink = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user.isSeller) {
            return res.status(403).send({ error: true, message: 'Only sellers can onboard with Stripe.' });
        }

        // Create Stripe account if not exists
        if (!user.stripeAccountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                email: user.email,
                capabilities: { transfers: { requested: true }, card_payments: { requested: true } }
            });
            user.stripeAccountId = account.id;
            await user.save();
        }

        // Create account link for onboarding
        const accountLink = await stripe.accountLinks.create({
            account: user.stripeAccountId,
            refresh_url: `${process.env.FRONTEND_URL}/account`,
            return_url: `${process.env.FRONTEND_URL}/account`,
            type: 'account_onboarding',
        });

        return res.send({ url: accountLink.url });
    } catch (error) {
        return res.status(500).send({ error: true, message: error.message });
    }
};

const addSellerIban = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user.isSeller) {
            return res.status(400).send({ error: true, message: 'Seller must complete Stripe onboarding first.' });
        }

        const { iban, accountHolderName, amount, statuses } = req.body;
        if (!iban || !accountHolderName) {
            return res.status(400).send({ error: true, message: 'Missing required fields.' });
        }

        const withdraw = await Withdrawal.create({
            sellerID: user._id,
            amount,
            type: 'manual',
            status: 'pending',
            country: user.country || 'pk',
            iban,
            accountHolderName
        });

        if (Array.isArray(statuses) && statuses.length > 0) {
            await OrderStatus.updateMany(
                { _id: { $in: statuses.map(id => new mongoose.Types.ObjectId(id._id)) } },
                { $set: { withdrawn: true } }
            );
        }

        return res.send({
            error: false,
            message: 'Withdrawal processed successfully.',
            withdraw
        });
    } catch (error) {
        return res.status(500).send({ error: true, message: error.message });
    }
};

const withdrawSellerFunds = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user.isSeller || !user.stripeAccountId) {
            return res.status(403).send({ error: true, message: 'Seller account with Stripe Connect required.' });
        }

        const { amount } = req.body;
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).send({ error: true, message: 'Valid amount is required for withdrawal.' });
        }

        await Withdrawal.create({
            seller: user._id,
            amount,
            stripeTransferId: transfer.id,
            status: 'completed',
        });

        return res.send({
            error: false,
            message: 'Withdrawal processed successfully.',
            transfer
        });

    } catch (error) {
        return res.status(500).send({
            error: true,
            message: error.message || 'Internal server error during withdrawal.'
        });
    }
};

module.exports = {
    deleteUser, fetchTopSellers, createStripeAccountLink, addSellerIban, withdrawSellerFunds
}

