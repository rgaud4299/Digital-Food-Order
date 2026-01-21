const prisma = require('../../utils/prisma');
const { error, success } = require('../../utils/response');


async function getRestaurantMenu(req, res) {
    try {
        // restaurant_id from params (validated by middleware)
        const restaurant_id = Number(req.body.restaurant_id);
        // Basic categories + items query (only active & visible)
        const categories = await prisma.food_categories.findMany({
            where: {
                restaurant_id,
                status: 'Active'
            },
            orderBy: { sequence: 'asc' },
            include: {
                food_items: {
                    where: {
                        is_visible: true,
                        is_deleted: false,
                        status: 'Active'
                    },
                    orderBy: { sequence: 'asc' },
                    include: {
                        food_variants: {
                            where: { is_available: true },
                            orderBy: [{ price: 'asc' }]
                        },
                        media_items: true,
                        // Assuming food_addons has group relation named addon_group and addon_group has addons.
                        food_addons: {
                            include: {
                                order_addons: {
                                    select: { order_item_id: true }
                                }
                            }
                        },

                        combo_items: true
                    }
                }
            }
        });

        // Map DB shape to frontend-friendly structure
        const data = categories.map(cat => ({
            category_id: cat.id,
            category_name: cat.name,
            category_icon: cat.icon,
            sequence: cat.sequence,
            items: cat.food_items.map(item => {
                const variants = (item.food_variants || []).map(v => ({
                    variant_id: v.id,
                    name: v.name,
                    portion_type: v.portion_type,
                    sku: v.sku,
                    price: Number(v.price),
                    cost_price: v.cost_price ? Number(v.cost_price) : null,
                    is_available: v.is_available,
                    stock_control: v.stock_control
                }));

                // addon groups normalization
                const addon_groups = (item.food_addons || []).reduce((acc, fa) => {
                    if (!fa.addon_group) return acc;
                    const grp = fa.addon_group;
                    acc.push({
                        group_id: grp.id,
                        group_name: grp.name,
                        min: grp.min ?? 0,
                        max: grp.max ?? 0,
                        addons: (grp.addons || []).map(a => ({
                            addon_id: a.id,
                            name: a.name,
                            price: Number(a.price)
                        }))
                    });
                    return acc;
                }, []);

                const images = (item.media_items || []).map(m => m.url);
                const min_price = variants.length ? variants[0].price : null;
                const max_price = variants.length ? variants[variants.length - 1].price : null;

                return {
                    id: item.id,
                    name: item.name,
                    item_icon:item.icon,
                    description: item.description || '',
                    type: item.type,
                    rating: item.rating ?? 0,
                    rating_count: item.rating_count ?? 0,
                    is_featured: !!item.is_featured,
                    is_visible: !!item.is_visible,
                    sequence: item.sequence ?? 0,
                    images,
                    variants,
                    addon_groups,
                    combos: item.combo_items || [],
                    min_price,
                    max_price
                };
            })
        }));

        return success(res, 'Menu fetched', { data });
    } catch (err) {
        console.error('getRestaurantMenu error', err);
        return error(res, 'Unable to fetch menu', 500, err.message);
    }
}

async function getItemsWithFilters(req, res) {
    try {
        const restaurant_id = Number(req.body.restaurant_id);
        const q = req.query || {};

        const page = q.page || 1;
        const limit = q.limit || 20;
        const skip = (page - 1) * limit;

        // Build where clause
        const where = {
            restaurant_id,
            is_visible: true,
            is_deleted: false,
            status: 'Active'
        };

        if (q.category_id) where.category_id = Number(q.category_id);
        if (q.featured) where.is_featured = true;
        if (q.veg && !q.non_veg) where.type = 'Veg';
        if (q.non_veg && !q.veg) where.type = 'NonVeg';

        if (q.search) {
            where.OR = [
                { name: { contains: q.search, mode: 'insensitive' } },
                { description: { contains: q.search, mode: 'insensitive' } },
                { search_keywords: { contains: q.search, mode: 'insensitive' } }
            ];
        }

        /**
         * Price filtering needs join with variants. Prisma doesn't allow filtering on related data with aggregated conditions directly in findMany easily,
         * but we can:
         * 1) If price filters exist, fetch variants matching price and get distinct food_item_id list
         * 2) Add where.id = { in: ids } to items query
         */
        let itemIdsFromVariantFilter = null;
        if (q.min_price != null || q.max_price != null) {
            const variantWhere = { restaurant_id, is_available: true };
            if (q.min_price != null) variantWhere.price = { gte: Number(q.min_price) };
            if (q.max_price != null) variantWhere.price = { ...(variantWhere.price || {}), lte: Number(q.max_price) };

            const variants = await prisma.food_variants.findMany({
                where: variantWhere,
                select: { food_item_id: true }
            });
            itemIdsFromVariantFilter = [...new Set(variants.map(v => Number(v.food_item_id)))];
            // if no variants matched, return empty
            if (itemIdsFromVariantFilter.length === 0) {
                return success(res, 'Items fetched', { total: 0, totalFiltered: 0, data: [] });
            }
            where.id = { in: itemIdsFromVariantFilter };
        }

        // Build orderBy
        let orderBy = { sequence: 'asc' };
        if (q.sort === 'price_low') orderBy = { food_variants: { _min: { price: 'asc' } } };
        if (q.sort === 'price_high') orderBy = { food_variants: { _max: { price: 'desc' } } };
        if (q.sort === 'rating_high') orderBy = { rating: 'desc' };
        if (q.sort === 'rating_low') orderBy = { rating: 'asc' };

        // total count (before pagination)
        const total = await prisma.food_items.count({ where });

        // fetch items with includes
        const items = await prisma.food_items.findMany({
            where,
            orderBy,
            include: {
                food_variants: {
                    where: { is_available: true },
                    orderBy: { price: 'asc' }
                },
                media_items: true,
                food_addons: {
                    include: { addon_group: { include: { addons: true } } }
                }
            },
            skip,
            take: limit
        });

        // map to frontend shape
        const data = items.map(item => {
            const variants = (item.food_variants || []).map(v => ({
                variant_id: v.id,
                name: v.name,
                portion_type: v.portion_type,
                sku: v.sku,
                price: Number(v.price),
                cost_price: v.cost_price ? Number(v.cost_price) : null,
                is_available: v.is_available,
                stock_control: v.stock_control
            }));

            const addon_groups = (item.food_addons || []).reduce((acc, fa) => {
                if (!fa.addon_group) return acc;
                const grp = fa.addon_group;
                acc.push({
                    group_id: grp.id,
                    group_name: grp.name,
                    min: grp.min ?? 0,
                    max: grp.max ?? 0,
                    addons: (grp.addons || []).map(a => ({
                        addon_id: a.id,
                        name: a.name,
                        price: Number(a.price)
                    }))
                });
                return acc;
            }, []);

            const images = (item.media_items || []).map(m => m.url);
            const min_price = variants.length ? variants[0].price : null;
            const max_price = variants.length ? variants[variants.length - 1].price : null;

            return {
                id: item.id,
                name: item.name,
                description: item.description || '',
                type: item.type,
                rating: item.rating ?? 0,
                rating_count: item.rating_count ?? 0,
                is_featured: !!item.is_featured,
                is_visible: !!item.is_visible,
                sequence: item.sequence ?? 0,
                images,
                variants,
                addon_groups,
                min_price,
                max_price
            };
        });

        return success(res, 'Items fetched', { total, totalFiltered: data.length, data });
    } catch (err) {
        console.error('getItemsWithFilters error', err);
        return error(res, 'Unable to fetch items', 500, err.message);
    }
}


module.exports = {
    getRestaurantMenu,
    getItemsWithFilters
};
