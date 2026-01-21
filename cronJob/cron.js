// cron/monthlyBilling.js
const cron = require('node-cron');
const { generateInvoicesForAll } = require('./billingRunner');

// schedule: 05 minutes after midnight on 1st of every month
cron.schedule('5 0 1 * *', async () => {
  console.log('Running monthly billing...');
  try {
    await generateInvoicesForAll();
    console.log('Monthly billing completed');
  } catch (err) {
    console.error('Monthly billing error', err);
  }
});
