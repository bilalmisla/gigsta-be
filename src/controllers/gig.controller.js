const mongoose = require('mongoose');
const { Gig } = require('../models');
const { CustomException } = require('../utils');

const SORT_OPTIONS = Object.freeze({
    sales: { sales: -1 },
    createdAt: { createdAt: -1 },
    price: { price: -1 },
    totalStars: { totalStars: -1 },
});

const escapeRegExp = (value) =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const toOptionalNumber = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    const num = Number.parseFloat(value);
    return Number.isFinite(num) ? num : undefined;
};

const toObjectIdString = (value) => {
    if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
        return undefined;
    }
    return value;
};

const toSafeSearchString = (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 100) : undefined;
};

const buildGigFilters = ({ category, search, max, min, userID }) => {
    const filters = {};

    const safeUserId = toObjectIdString(userID);
    if (safeUserId) {
        filters.userID = { $eq: safeUserId };
    }

    const safeCategory = toSafeSearchString(category);
    if (safeCategory) {
        filters.category = { $regex: escapeRegExp(safeCategory), $options: 'i' };
    }

    const safeSearch = toSafeSearchString(search);
    if (safeSearch) {
        filters.title = { $regex: escapeRegExp(safeSearch), $options: 'i' };
    }

    const minPrice = toOptionalNumber(min);
    const maxPrice = toOptionalNumber(max);
    if (minPrice !== undefined || maxPrice !== undefined) {
        filters.price = {
            ...(maxPrice !== undefined && { $lte: maxPrice }),
            ...(minPrice !== undefined && { $gte: minPrice }),
        };
    }

    return filters;
};

const createGig = async (request, response) => {
    try {
        const gig = new Gig({
            userID: request.userID,
            ...request.body
        });
        await gig.save();
        return response.status(201).send(gig);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const updateGig = async (request, response) => {
    const { _id } = request.params;
    try {
        const result = await Gig.updateOne({ _id }, { $set: { ...request.body } });
        return response.status(201).send(result);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const deleteGig = async (request, response) => {
    const { _id } = request.params;

    try {
        const gig = await Gig.findOne({ _id });
        if (request.userID === gig.userID.toString()) {
            await Gig.deleteOne({ _id });
            return response.send({
                error: false,
                message: 'Gig has been successfully deleted!'
            })
        }

        throw CustomException('Invalid request! Cannot delete other user gigs!', 403);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const getGig = async (request, response) => {
    const { _id } = request.params;

    try {
        const gig = await Gig.findOne({ _id }).populate('userID', 'username fullname country image createdAt email description');
        if (!gig) {
            throw CustomException('Gig not found!', 404);
        }
        return response.send(gig);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const getGigs = async (request, response) => {
    const { category, search, max, min, userID, sort } = request.query;
    try {
        const filters = buildGigFilters({ category, search, max, min, userID });
        const sortSpec = (typeof sort === 'string' && SORT_OPTIONS[sort]) || SORT_OPTIONS.sales;

        const gigs = await Gig.find(filters)
            .sort(sortSpec)
            .populate('userID', 'username fullname cover email description isSeller _id image');
        return response.send(gigs);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

module.exports = {
    createGig,
    deleteGig,
    getGig,
    getGigs,
    updateGig
}
