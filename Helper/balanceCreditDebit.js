const prisma = require('../utils/prisma');
const { error, success } = require('../utils/response'); // aapka helper
const { RESPONSE_CODES, generateRandomTxnId, ISTFormat } = require('../utils/helper');
const withAudit = require('../utils/withAudit');

// Main Controller
let ip = null;
const balanceCreditDebit = async (req, res) => {
    ip = req.ip;
    try {
        let {
            transfer_by,
            mode,
            gateway_id = 0,
            user_id,
            amount,
            payment_mode,
            transfer_type,
            reference_number = '',
            bank_id = 0,
            remark = "",
            order_id = '',
        } = req.body;
        amount = amount + ""

        let txn_id;
        if (mode === 'Manual' && transfer_type === "credit") {
            // const loadMoney = await prisma.load_money_records.findFirst({ where: { payment_id: order_id } });
            // txn_id = loadMoney ? loadMoney.txn_id : generateRandomTxnId('txn');
            txn_id = generateRandomTxnId();

        } else {
            txn_id = generateRandomTxnId();
        }

        const senderDetails = await prisma.users.findUnique({ where: { uuid: transfer_by } });
        if (!senderDetails) return error(res, 'Sender not found.');

        const sender_name = senderDetails.company_name;
        const sender_user_type = senderDetails.role;

        const checkLastTransfer = await prisma.fund_transfer_report.findFirst({
            where: { transfer_type, user_id, amount },
            orderBy: { id: 'desc' }
        });

        const system_setting = await prisma.add_money_amount_range.findFirst({
            select: { min_amt: true, max_amt: true }
        });



        system_setting.transfer_interval = 0;
        system_setting.min_amt = Number(system_setting.min_amt);
        system_setting.max_amt = Number(system_setting.max_amt);

        const currentTime = Date.now() / 1000;
        let lastTransferTime = 0;
        if (checkLastTransfer) {
            lastTransferTime = new Date(checkLastTransfer.created_at).getTime() / 1000 + system_setting.transfer_interval;
        }

        if (currentTime > lastTransferTime) {

            if (amount >= system_setting.min_amt && amount <= system_setting.max_amt) {

                const result = await balanceCreditDebit2(
                    txn_id, user_id, transfer_by, transfer_type, amount,
                    payment_mode, reference_number, remark, sender_name,
                    sender_user_type, bank_id, mode, gateway_id, "balance", order_id
                );

                if (result.status_code === 1) {
                    return success(res, result.message);
                } else {
                    return error(res, result.message);
                }
            } else {
                return error(
                    res,
                    `Amount should be in range of ${system_setting.min_amt} to ${system_setting.max_amt} rs.`
                );
            }
        } else {
            const minutes = system_setting.transfer_interval / 60;
            return error(
                res,
                `You cannot ${transfer_type} same amount to same user within ${minutes} minutes`
            );
        }
    } catch (err) {
        console.error("balanceCreditDebit error:", err);
        return error(res, "Internal Server Error");
    }
};

module.exports = { balanceCreditDebit };


// Helper Function
async function balanceCreditDebit2(
    txn_id, user_id, transfer_by, transfer_type, amount,
    payment_mode, reference_number, remark, sender_name,
    sender_user_type, bank_id, mode, gateway_id, walletType, order_id
) {
    const date = new Date();
    const wallet_type = walletType || 'balance';

    const getUserData = await prisma.users.findUnique({ where: { uuid: user_id } });
    if (!getUserData) return { status_code: RESPONSE_CODES.FAILED, message: 'User not found.' };

    const user_type = getUserData.role;
    const dealer_name = getUserData.name;

    const securityData = await prisma.login_history.findFirst({
        where: { user_id: transfer_by },
        orderBy: { id: 'desc' }
    });
    if (!securityData) return { status_code: RESPONSE_CODES.FAILED, message: 'Unauthorized access' };

    const loadMoney = 0
    //  const loadMoney =await prisma.load_money_records.findUnique({ where: { txn_id } });
    const wallet = await prisma.wallets.findUnique({ where: { user_id } });
    if (!wallet) return { status_code: RESPONSE_CODES.FAILED, message: 'Wallet not found' };

    const opening_bal = wallet[wallet_type];

    let closing_bal, trans_type, description;
    if (transfer_type == "credit") {
        closing_bal = (opening_bal + +amount).toString();
        trans_type = 'credit';

        description = `Balance Received From ${sender_name} [${sender_user_type}]`;
    } else {
        closing_bal = (opening_bal - amount).toString();

        trans_type = 'debit';
        description = `Balance Debit By ${sender_name} [${sender_user_type}]`;
    }

    const fund_transfer_report = {
        txn_id,
        user_type,
        user_id,
        transfer_type,
        wallet_type,
        amount,
        gst: loadMoney?.gst || "0",
        total: loadMoney?.total || "0",
        pre_bal_recv: opening_bal + "",
        post_bal_recv: closing_bal + "",
        transfer_by: transfer_by.toString(),
        transfer_type_sender: sender_user_type,
        pre_bal_sender: "0",
        post_bal_sender: "0",
        bank_id,
        payment_mode,
        reference_no: reference_number,
        remark,
        mode,
        gateway_id,
        created_at: date,
        updated_at: date
    };

    const transReportDataUser = {
        txn_id,
        ip: securityData.ip_address,
        longitude: securityData.longitude.toString(),
        latitude: securityData.latitude.toString(),
        status: 'SUCCESS',
        user_type,
        credit_debit: trans_type,
        user_id,
        transaction_mode: mode,
        transaction_group: 'Wallet_Balance',
        wallet_type,
        description,
        opening_bal: opening_bal.toString(),
        amount: amount.toString(),
        closing_bal,
        created_at: date,
        updated_at: date
    };

    try {


        await prisma.$transaction(async (tx) => {

            await withAudit("create", "fund_transfer_report", { data: fund_transfer_report }, user_id, ip, tx);
            await withAudit("create", "transaction_report", { data: transReportDataUser }, user_id, ip, tx);

            if (trans_type === 'credit') {
                await withAudit("update", "wallets", {
                    where: { user_id },
                    data: { [wallet_type]: { increment: parseFloat(amount) } }
                }, transfer_by || null, ip, tx);
            } else {
                await withAudit("update", "wallets", {
                    where: { user_id },
                    data: { [wallet_type]: { decrement: parseFloat(amount) } }
                }, transfer_by || null, ip, tx);
            }
        });

        const message =
            transfer_type === "credit"
                ? `Rs ${amount} has been credited to ${dealer_name}`
                : `Rs ${amount} has been debited from ${dealer_name}`;

        return { status_code: 1, message, txn_id, current_balance: closing_bal };
    } catch (err) {
        console.error("Transaction failed:", err);
        return { status_code: RESPONSE_CODES.FAILED, message: 'Unable to process your request' };
    }
}
