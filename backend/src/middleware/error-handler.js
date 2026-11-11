'use strict';

const { error } = require('../utils');

module.exports = function (app) {
app.use((err, req, res, next) => {
    console.error(err);

    const code = err.code === 400 ? 400 : 500;
    const message = err.code === 400
        ? err.message
        : 'Lỗi máy chủ';

    return error(res, code, message);
});
};
