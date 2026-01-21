const prisma = require('../../utils/prisma');
const { success, error } = require('../../utils/response');


exports. getInvoiceByOrderId = async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await prisma.orders.findUnique({
            where: { id: BigInt(orderId) },
            include: {
                restaurant: true,
                customer: true,
                payments: true,
                order_items: {
                    include: {
                        food_items: true,
                        order_addons: {
                            include: { food_addons: true },
                        },
                    },
                },
            },
        });

        if (!order) return error(res, "Order not found");

        const invoice = {
            invoice_no: `INV-${order.id}`,
            invoice_date: order.created_at,
            status: order.payment_status === "Paid" ? "Paid" : "Unpaid",
            currency: order.currency,
            restaurant: {
                name: order.restaurant.name,
                address: order.restaurant.metadata?.address,
                phone: order.restaurant.metadata?.phone,
                gst_no: order.restaurant.metadata?.gst_no,
            },
            customer: order.customer
                ? {
                    name: order.customer.email || "Guest",
                    email: order.customer.email,
                    mobile_no: order.customer.mobile_no,
                }
                : null,
            order: {
                order_no: order.order_no,
                channel: order.channel,
                delivery_type: order.delivery_type,
                created_at: order.created_at,
            },
            items: order.order_items.map((item) => ({
                name: item.food_items.name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                addons: item.order_addons.map((a) => ({
                    name: a.food_addons.name,
                    price: a.price,
                })),
            })),
            summary: {
                subtotal: Number(order.total_amount),
                tax_amount: Number(order.tax_amount ?? 0),
                discount: Number(order.discount_amount ?? 0),
                delivery_fee: Number(order.delivery_fee ?? 0),
                tips: Number(order.tips_amount ?? 0),
                total: Number(order.net_amount),
            },
            payment:
                order.payments.length > 0
                    ? {
                        method: order.payments[0].method,
                        provider: order.payments[0].provider,
                        transaction_id: order.payments[0].provider_ref,
                        paid_at: order.payments[0].captured_at,
                    }
                    : null,
        };

        return success(res, "Invoice fatch Successfully", invoice);
    } catch (err) {
        console.error(err);
        return error(res, "Server error");
    }
};

