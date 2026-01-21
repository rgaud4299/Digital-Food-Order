exports.getVendorCommercial = function getVendorCommercial(data, amount) {
   
    const gst = parseFloat(data.gst ?? 0) || 0;
    const tds = parseFloat(data.tds ?? 0) || 0;
    const rate = parseFloat(data.rate ?? 0) || 0;
    const flat_per = (data.flat_per ?? "flat").toLowerCase();
    const type = (data.commission_surcharge ?? "commission").toLowerCase();
    const productAmount = parseFloat(data.productAmount ?? 0) || 0;
    amount = parseFloat(amount ?? 0) || 0;

    let commission_surcharge = 0;
    let charged_amount = 0;

    if (flat_per === "percent") {
        commission_surcharge = (amount * rate) / 100;
    } else {
        commission_surcharge = rate;
    }

    if (type === "commission") {
        charged_amount = amount - commission_surcharge;
    } else {
        charged_amount = amount + commission_surcharge;
    }

    const vendor_gst = (commission_surcharge * gst) / 100;
    const vendor_tds = (commission_surcharge * tds) / 100;

    charged_amount = charged_amount + vendor_gst + vendor_tds;

    const format = (val) => (isNaN(val) ? "0.00" : val.toFixed(2));

    return {
        amount: format(amount),
        final_amt: format(charged_amount),
        surcharge: type === "surcharge" ? format(commission_surcharge) : "0.00",
        flat_per: flat_per,
        vendor_type:type,
        vendor_gst: format(vendor_gst),
        vendor_tds: format(vendor_tds),
        vendor_commission: type === "commission" ? format(commission_surcharge) : "0.00",
        vendor_surcharge: type === "surcharge" ? format(commission_surcharge) : "0.00",
        vendor_flat_per: flat_per,
        vendor_debit_amt: format(charged_amount),
        api_balance: null,
        api_msg: null,
        message: "Vendor commercial calculation completed"
    };
};
