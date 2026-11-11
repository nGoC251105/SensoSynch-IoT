'use strict';

const express = require('express');
const path = require('path');

module.exports = function (app, backendDir) {
app.use(
    express.static(
        path.resolve(backendDir, '../frontend')
    )
);

app.get('/', (req, res) => {
    res.sendFile(
        path.resolve(backendDir, '../frontend/index.html')
    );
});
};
