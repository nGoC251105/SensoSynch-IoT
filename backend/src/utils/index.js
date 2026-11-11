'use strict';

const iso = (s) => {
    return `${s.replace(' ', 'T')}Z`;
};

const utcSql = (d) => {
    return new Date(d)
        .toISOString()
        .replace('T', ' ')
        .replace('Z', '');
};

const timestamp = () => {
    return utcSql(new Date());
};

const error = (res, code, message) => {
    return res.status(code).json({
        error: message
    });
};

const validState = (s) => {
    return s === 'ON' || s === 'OFF';
};

const integer = (v, fallback, max = 1000000) => {
    const n = v === undefined
        ? fallback
        : Number(v);

    if (Number.isInteger(n) && n >= 1 && n <= max) {
        return n;
    }

    return null;
};

// Chuyển ngày Việt Nam sang khoảng thời gian UTC để lọc MySQL.
function vnDayRange(date) {
    if (!date) {
        return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw Object.assign(
            new Error('Ngày không hợp lệ'),
            { code: 400 }
        );
    }

    const d = new Date(
        date + 'T00:00:00+07:00'
    );

    const validDate = Number.isFinite(d.valueOf());
    const normalizedDay = new Date(
        d.valueOf() + 7 * 3600000
    ).toISOString().slice(0, 10);

    if (!validDate || normalizedDay !== date) {
        throw Object.assign(
            new Error('Ngày không hợp lệ'),
            { code: 400 }
        );
    }

    return [
        utcSql(d),
        utcSql(new Date(d.valueOf() + 86400000))
    ];
}

// Đọc page, size từ query và tính offset.
function parsePaging(req) {
    const page = integer(req.query.page, 1);
    const size = integer(req.query.size, 10, 100);

    if (!page || !size) {
        throw Object.assign(
            new Error('page/size không hợp lệ'),
            { code: 400 }
        );
    }

    return {
        page,
        size,
        offset: (page - 1) * size
    };
}

function safeRoute(fn) {
    return (req, res, next) => {
        return Promise.resolve(
            fn(req, res)
        ).catch(next);
    };
}

module.exports = { iso, utcSql, timestamp, error, validState, integer, vnDayRange, parsePaging, safeRoute };
