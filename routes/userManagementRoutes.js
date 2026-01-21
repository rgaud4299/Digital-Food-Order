const express = require('express');
const createSecuredRoutes = require('../utils/createSecuredRoutes');
const {authMiddleware} = require('../middleware/auth');
const { idParamValid, ListValidation } = require('../validators/commonValidators');
const { getUserList, getUserListAdmin, getUserWalletTotalsBalance, WalletTotalsBalance } = require('../controllers/Admin/User Management/User');
const { userListValidation } = require('../validators/userManagement');

const router = express.Router();

const securedRoutes = createSecuredRoutes([authMiddleware], (router) => {

    router.post('/users/get-list', userListValidation, getUserList);
    router.post('/admin/users/get-list', userListValidation, getUserListAdmin);
    router.post('/admin/users/balance',  WalletTotalsBalance);

})

router.use('/', securedRoutes)

module.exports = router;
