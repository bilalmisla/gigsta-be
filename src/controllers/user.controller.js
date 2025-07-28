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
                capabilities: { transfers: { requested: true } }
            });
            user.stripeAccountId = account.id;
            await user.save();
        }

        // Create account link for onboarding
        const accountLink = await stripe.accountLinks.create({
            account: user.stripeAccountId,
            refresh_url: `${process.env.FRONTEND_URL}/stripe/reauth`,
            return_url: `${process.env.FRONTEND_URL}/stripe/success`,
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
        if (!user.isSeller || !user.stripeAccountId) {
            return res.status(400).send({ error: true, message: 'Seller must complete Stripe onboarding first.' });
        }

        const { iban, accountHolderName, country, currency } = req.body;
        if (!iban || !accountHolderName || !country || !currency) {
            return res.status(400).send({ error: true, message: 'Missing required fields.' });
        }

        // Add IBAN as external account to Stripe Connect account
        const bankAccount = await stripe.accounts.createExternalAccount(
            user.stripeAccountId,
            {
                external_account: {
                    object: 'bank_account',
                    country,
                    currency,
                    account_holder_name: accountHolderName,
                    account_number: iban
                }
            }
        );

        // Optionally, save the bank account info in your DB
        const paymentMethod = await PaymentMethod.create({
            bankId: bankAccount.id,
            last4: bankAccount.last4,
            bankName: bankAccount.bank_name,
            country: bankAccount.country,
            currency: bankAccount.currency,
            status: bankAccount.status // 'new', 'verified', etc.
        });
        await paymentMethod.save();

        // Check verification status
        if (bankAccount.status === 'verified') {
            return res.send({ error: false, message: 'IBAN verified and added as payout method.', paymentMethod });
        } else {
            return res.send({ error: false, message: 'IBAN added, pending verification.', paymentMethod });
        }
    } catch (error) {
        return res.status(500).send({ error: true, message: error.message });
    }
};


/**
 * Seller Withdrawal Handler (using OrderStatus for accurate available funds)
 */
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

        const { availableFunds, eligibleStatusIds } = await calculateSellerAvailableFunds(user._id);

        if (amount > availableFunds) {
            return res.status(400).send({
                error: true,
                message: `Insufficient available funds. You have $${availableFunds.toFixed(2)} available for withdrawal.`
            });
        }

        // 🪐 Create Stripe transfer to seller
        const transfer = await stripe.transfers.create({
            amount: Math.round(amount * 100),
            currency: 'usd',
            destination: user.stripeAccountId,
            transfer_group: `SELLER_WITHDRAW_${user._id}_${Date.now()}`
        });

        // 🪐 Mark relevant OrderStatuses as withdrawn until amount is fulfilled
        let remaining = amount;
        for (const statusId of eligibleStatusIds) {
            if (remaining <= 0) break;
            const status = await OrderStatus.findById(statusId);
            if (!status) continue;

            const order = orderMap.get(status.orderID?.toString());
            if (!order) continue;

            const gigItem = order.gigs.find(g =>
                g.gigID.toString() === status.gigID.toString() &&
                g.sellerID.toString() === user._id.toString()
            );
            if (!gigItem) continue;

            const gigAmount = gigItem.total || gigItem.price || 0;

            status.withdrawn = true;
            await status.save();

            remaining -= gigAmount;
        }

        // 🪐 Track withdrawal in Withdrawal model
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

