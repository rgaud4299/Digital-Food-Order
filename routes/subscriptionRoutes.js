const express = require('express');
const router = express.Router();
const sub = require('../controllers/Subscription/subscriptionController');
const inv = require('../controllers/Subscription/subscriptionInvoiceController');


router.post('/create', sub.createPlan); 
router.get('/get-list', sub.listPlans);
router.get('/byid/:id', sub.getPlanById);
router.post('/buy', sub.assignPlanToRestaurant); 

router.get('/invoice/get-list', inv.listInvoices); 
router.get('/byid/:id', inv.getInvoiceById);
router.post('/mark-paid/:id', inv.markInvoicePaid);
router.post('/generate-manual', inv.generateInvoicesManual);

module.exports = router;
