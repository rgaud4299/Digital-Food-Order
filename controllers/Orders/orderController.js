const { error, success, successGetAll } = require("../../utils/response");
const { orderProcessCheck, orderRequest } = require("../../Helper/OrderHelper");
const { getDayUTC, ISTFormat } = require("../../utils/helper");

const placeOrder = async (req, res) => {
  try {
    const { restaurant_id, table_id, items, delivery_type, note = "" } = req.body;
    let { customer_id } = req.customer
    if (!restaurant_id || !items || items.length === 0) {
      return error(res, "Restaurant and at least one item are required", 400);
    }
    // STEP 1: Validate & compute totals
    const checkResult = await orderProcessCheck({
      restaurant_id,
      table_id,
      customer_id,
      items,
      delivery_type,
      note
    });

    if (checkResult.status === "FAILED") {
      return error(res, checkResult.message, 422);
    }

    // STEP 2: Create order + items
    const orderResult = await orderRequest(checkResult.data);
    if (orderResult.status === "FAILED") {
      return error(res, orderResult.message, 400);
    }

    return success(res, "Order placed successfully", orderResult.data);
  } catch (err) {
    console.error("❌ Order placement error:", err);
    return error(res, "Internal server error", 500);
  }
};

const getOrderList = async (req, res) => {
  try {
    let {
      offset = 0,
      limit = 10,
      restaurant_id,
      order_no,
      status,
      payment_status,
      payment_method,
      channel,
      delivery_type,
      start_date = null,
      end_date = null,
      min_amount,
      max_amount
    } = req.body || {};
    req.user = {}
    req.user.role = "Admin"

    let { customer_id } = req.customer
    // offset = safeParseInt(offset, 0);
    // limit = safeParseInt(limit, 10);

    start_date = getDayUTC(start_date, true);
    end_date = getDayUTC(end_date);

    const skip = offset * limit;

    /* ---------------- ROLE BASE ACCESS ---------------- */
    const roleWhere = [];

    if (customer_id || req.customer.role === "Customer") {
      // roleWhere.push({ customer_id: BigInt(req.user.uuid) });
      roleWhere.push({ customer_id: BigInt(customer_id) });

    } else if (restaurant_id || req.user.role === "Admin") {
      // roleWhere.push({ restaurant_id: BigInt(req.user.restaurant_id) });
      roleWhere.push({ restaurant_id: BigInt(restaurant_id) });

    }

    // PlatformAdmin => no restriction
    const where = {
      AND: [
        ...roleWhere,
        restaurant_id ? { restaurant_id: BigInt(restaurant_id) } : null,
        customer_id ? { customer_id: BigInt(customer_id) } : null,
        order_no ? { order_no: { contains: order_no, mode: "insensitive" } } : null,
        status ? { status: { equals: status } } : null,
        payment_status ? { payment_status: { equals: payment_status } } : null,
        payment_method ? { payment_method: { equals: payment_method } } : null,
        channel ? { channel: { equals: channel } } : null,
        delivery_type ? { delivery_type: { equals: delivery_type } } : null,
        start_date ? { created_at: { gte: start_date } } : null,
        end_date ? { created_at: { lte: end_date } } : null,
        min_amount ? { net_amount: { gte: Number(min_amount) } } : null,
        max_amount ? { net_amount: { lte: Number(max_amount) } } : null,
      ].filter(Boolean),
    };

    /* ---------------- DB QUERIES ---------------- */
    const [total, filteredCount, orders] = await Promise.all([
      prisma.orders.count(),
      prisma.orders.count({ where }),
      prisma.orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          restaurant: { select: { uuid: true, name: true } },
          customer: { select: { uuid: true, name: true, mobile_no: true } },
          order_items: {
            include: {
              food_items: { select: { id: true, name: true } },
              food_variants: { select: { id: true, name: true } },
              order_addons: {
                include: {
                  food_addons: { select: { id: true, name: true } }
                }
              },
              item_options: true
            }
          }
        }
      })
    ]);

    /* ---------------- RESPONSE FORMAT ---------------- */
    const formattedData = orders.map((order, index) => ({
      order_details: {
        id: order.id,
        serial_no: skip + index + 1,
        order_no: order.order_no,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        channel: order.channel,
        delivery_type: order.delivery_type,
        currency: order.currency,
        total_amount: order.total_amount,
        tax_amount: order.tax_amount,
        discount_amount: order.discount_amount,
        tips_amount: order.tips_amount,
        net_amount: order.net_amount,
        created_at: ISTFormat(order.created_at),
        updated_at: ISTFormat(order.updated_at)
      },
      restaurant_details: order.restaurant,
      customer_details: order.customer,
      items: order.order_items.map(item => ({
        id: item.id,
        name: item.food_items?.name,
        variant: item.food_variants?.name || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        addons: item.order_addons.map(a => ({
          name: a.food_addons?.name,
          price: a.price
        })),
        options: item.item_options
      }))
    }));

    return successGetAll(
      res,
      "Orders fetched successfully",
      formattedData,
      total,
      filteredCount
    );

  } catch (err) {
    console.error("getOrderList Error:", err);
    return error(res, "Server error", 0, 500);
  }
};


module.exports = { placeOrder, getOrderList };
