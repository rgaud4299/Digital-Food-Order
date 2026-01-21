const express = require('express');
const router = express.Router();
const {authMiddleware} = require('../middleware/auth');
const createSecuredRoutes = require('../utils/createSecuredRoutes');
const { verifyMpinController } = require('../middleware/verifyMpin');

const securedRoutes = createSecuredRoutes([authMiddleware], (router) => {

    router.post('/mpin/verify', verifyMpinController);

});


router.use('/', securedRoutes);

module.exports = router;
