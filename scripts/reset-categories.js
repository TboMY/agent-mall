require('dotenv').config();

const { mallPool, closePools } = require('../config/database');

const CATEGORY_SEEDS = [
  { id: 8, name: '服饰鞋包', parent_id: 0, sort_order: 10, description: '服饰、鞋履、箱包与配饰类商品' },
  { id: 9, name: '美妆个护', parent_id: 0, sort_order: 20, description: '护肤、彩妆、个护清洁等商品' },
  { id: 10, name: '数码家电', parent_id: 0, sort_order: 30, description: '手机数码、小家电与智能设备' },
  { id: 11, name: '家居生活', parent_id: 0, sort_order: 40, description: '家清、收纳、厨房与日用家居' },
  { id: 12, name: '食品饮料', parent_id: 0, sort_order: 50, description: '零食、冲饮、速食与饮料商品' },
  { id: 13, name: '运动户外', parent_id: 0, sort_order: 60, description: '运动服饰、露营与户外装备' },
  { id: 14, name: '母婴玩具', parent_id: 0, sort_order: 70, description: '母婴用品、儿童玩具与早教商品' },
  { id: 28, name: '其他', parent_id: 0, sort_order: 80, description: '暂未归类的其他商品' },

  { id: 15, name: '上衣', parent_id: 8, sort_order: 10, description: 'T恤、卫衣、衬衫等上衣类商品' },
  { id: 16, name: '下装', parent_id: 8, sort_order: 20, description: '裤装、半裙等下装类商品' },
  { id: 17, name: '连衣裙', parent_id: 8, sort_order: 30, description: '连衣裙与套装裙类商品' },
  { id: 18, name: '泳装', parent_id: 8, sort_order: 40, description: '泳衣、比基尼、防晒泳装类商品' },
  { id: 19, name: '配饰', parent_id: 8, sort_order: 50, description: '帽子、围巾、首饰等配饰商品' },
  { id: 20, name: '鞋子', parent_id: 8, sort_order: 60, description: '运动鞋、凉鞋、休闲鞋等鞋类商品' },
  { id: 21, name: '包包', parent_id: 8, sort_order: 70, description: '单肩包、双肩包、通勤包等商品' },

  { id: 22, name: '护肤', parent_id: 9, sort_order: 10, description: '精华、面霜、洁面等护肤商品' },
  { id: 23, name: '彩妆', parent_id: 9, sort_order: 20, description: '口红、粉底、眼影等彩妆商品' },
  { id: 24, name: '防晒', parent_id: 9, sort_order: 30, description: '防晒霜、防晒喷雾等商品' },

  { id: 27, name: '旅行用品', parent_id: 11, sort_order: 10, description: '收纳、洗漱与便携旅行用品' },
  { id: 25, name: '泳具', parent_id: 13, sort_order: 10, description: '泳镜、泳帽、浮板等游泳装备' },
  { id: 26, name: '健身服饰', parent_id: 13, sort_order: 20, description: '瑜伽服、速干衣、运动裤等商品' }
];

async function main() {
  const connection = await mallPool.getConnection();

  try {
    console.log('[category-seed] start');
    await connection.beginTransaction();

    await connection.query('DELETE FROM categories');

    for (const item of CATEGORY_SEEDS) {
      const level = item.parent_id === 0 ? 1 : 2;
      await connection.query(
        `INSERT INTO categories
         (id, name, parent_id, level, sort_order, icon, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, 1, NOW(), NOW())`,
        [item.id, item.name, item.parent_id, level, item.sort_order, item.description]
      );
    }

    await connection.query('ALTER TABLE categories AUTO_INCREMENT = 29');

    await connection.commit();
    console.log(`[category-seed] done count=${CATEGORY_SEEDS.length}`);
  } catch (error) {
    await connection.rollback();
    console.error('[category-seed] failed:', error);
    throw error;
  } finally {
    connection.release();
    await closePools();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
