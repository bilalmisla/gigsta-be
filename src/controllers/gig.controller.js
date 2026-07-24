const mongoose = require('mongoose');
const { Gig } = require('../models');
const { CustomException } = require('../utils');

const toOptionalNumber = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    const num = Number.parseFloat(value);
    return Number.isFinite(num) ? num : undefined;
};

const toObjectId = (value) => {
    if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
        return undefined;
    }
    return new mongoose.Types.ObjectId(value);
};

/** Map user slug → server-controlled constant (never echo raw input into the query). */
const resolveCategory = (value) => {
    switch (value) {
        case 'web-development':
            return 'web-development';
        case 'design':
            return 'design';
        case 'video-editing':
            return 'video-editing';
        case 'admin-work':
            return 'admin-work';
        default:
            return undefined;
    }
};

/** Map user sort key → prebuilt sort document (literals only). */
const resolveSort = (value) => {
    switch (value) {
        case 'createdAt':
            return { createdAt: -1 };
        case 'price':
            return { price: -1 };
        case 'totalStars':
            return { totalStars: -1 };
        case 'sales':
        default:
            return { sales: -1 };
    }
};

const toSafeSearchNeedle = (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().slice(0, 100).toLowerCase();
    return trimmed || undefined;
};

const toSafeText = (value, maxLength) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, maxLength) : undefined;
};

const toSafeStringArray = (value, maxItems, maxItemLength) => {
    if (!Array.isArray(value)) return undefined;
    return value
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim().slice(0, maxItemLength))
        .slice(0, maxItems);
};

/**
 * Accept only absolute https media URLs with no path-traversal sequences.
 * Returns the canonical href from URL parsing (never the raw user string).
 */
const toSafeMediaUrl = (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().slice(0, 2048);
    if (!trimmed) return undefined;

    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        return undefined;
    }

    if (parsed.protocol !== 'https:') return undefined;
    if (parsed.username || parsed.password) return undefined;
    if (parsed.pathname.includes('..') || /%2e/i.test(parsed.pathname)) return undefined;

    return parsed.href;
};

const toSafeMediaUrlList = (value) => {
    if (!Array.isArray(value)) return undefined;
    const urls = value
        .map(toSafeMediaUrl)
        .filter(Boolean)
        .slice(0, 20);
    return urls;
};

const buildGigPayload = (body = {}) => {
    const payload = {};

    const title = toSafeText(body.title, 120);
    if (title) payload.title = title;

    const description = toSafeText(body.description, 5000);
    if (description) payload.description = description;

    const category = toSafeText(body.category, 100);
    if (category) payload.category = category;

    const price = toOptionalNumber(body.price);
    if (price !== undefined) payload.price = price;

    const cover = toSafeMediaUrl(body.cover);
    if (cover) payload.cover = cover;

    const images = toSafeMediaUrlList(body.images);
    if (images) payload.images = images;

    const shortTitle = toSafeText(body.shortTitle, 80);
    if (shortTitle) payload.shortTitle = shortTitle;

    const shortDesc = toSafeText(body.shortDesc, 500);
    if (shortDesc) payload.shortDesc = shortDesc;

    const deliveryTime = toSafeText(body.deliveryTime, 40);
    if (deliveryTime) payload.deliveryTime = deliveryTime;

    const revisionNumber = toOptionalNumber(body.revisionNumber);
    if (revisionNumber !== undefined) payload.revisionNumber = revisionNumber;

    const features = toSafeStringArray(body.features, 30, 120);
    if (features) payload.features = features;

    return payload;
};

/**
 * Build a Mongo filter from allowlisted / typed values only.
 * Title search is intentionally excluded — apply it in-memory after find
 * so user-controlled strings never reach $regex / query operators.
 */
const buildGigFilters = ({ category, max, min, userID }) => {
    const filters = {};

    const safeUserId = toObjectId(userID);
    if (safeUserId) {
        filters.userID = { $eq: safeUserId };
    }

    const safeCategory = resolveCategory(category);
    if (safeCategory) {
        filters.category = { $eq: safeCategory };
    }

    const minPrice = toOptionalNumber(min);
    const maxPrice = toOptionalNumber(max);
    if (minPrice !== undefined || maxPrice !== undefined) {
        filters.price = {};
        if (maxPrice !== undefined) filters.price.$lte = maxPrice;
        if (minPrice !== undefined) filters.price.$gte = minPrice;
    }

    return filters;
};

const createGig = async (request, response) => {
    try {
        const gig = new Gig({
            userID: request.userID,
            ...buildGigPayload(request.body),
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
        const result = await Gig.updateOne({ _id }, { $set: buildGigPayload(request.body) });
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
        const filters = buildGigFilters({ category, max, min, userID });
        const sortSpec = resolveSort(typeof sort === 'string' ? sort : undefined);
        const searchNeedle = toSafeSearchNeedle(search);

        const gigs = await Gig.find(filters)
            .sort(sortSpec)
            .populate('userID', 'username fullname cover email description isSeller _id image');

        if (!searchNeedle) {
            return response.send(gigs);
        }

        // Substring match outside Mongo — keeps user text out of the query document
        const matched = gigs.filter(
            (gig) => typeof gig.title === 'string' && gig.title.toLowerCase().includes(searchNeedle)
        );
        return response.send(matched);
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
