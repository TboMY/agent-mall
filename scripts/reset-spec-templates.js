require('dotenv').config();

const { mallPool, closePools } = require('../config/database');

const TEMPLATE_SEEDS = [
  {
    categoryName: '服饰鞋包',
    name: '休闲上衣模板',
    description: '适用于T恤、卫衣、衬衫等日常上衣商品。',
    icon: 'shirt',
    sortOrder: 10,
    attributes: [
      {
        name: '颜色',
        key: 'color',
        description: '商品主色系',
        valueType: 'single',
        required: 1,
        sortOrder: 10,
        values: ['黑色', '白色', '灰色', '蓝色', '粉色']
      },
      {
        name: '尺码',
        key: 'size',
        description: '常见服装尺码',
        valueType: 'single',
        required: 1,
        sortOrder: 20,
        values: ['S', 'M', 'L', 'XL', '2XL']
      },
      {
        name: '面料',
        key: 'material',
        description: '面料成分或材质说明',
        valueType: 'custom',
        required: 0,
        sortOrder: 30,
        values: []
      }
    ]
  },
  {
    categoryName: '服饰鞋包',
    name: '鞋靴模板',
    description: '适用于运动鞋、休闲鞋、凉鞋等鞋类商品。',
    icon: 'shoe',
    sortOrder: 20,
    attributes: [
      {
        name: '颜色',
        key: 'color',
        description: '鞋款主色',
        valueType: 'single',
        required: 1,
        sortOrder: 10,
        values: ['黑色', '白色', '米色', '棕色', '拼色']
      },
      {
        name: '鞋码',
        key: 'shoe_size',
        description: '常见鞋码',
        valueType: 'single',
        required: 1,
        sortOrder: 20,
        values: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44']
      },
      {
        name: '适用场景',
        key: 'scene',
        description: '鞋类适用场景',
        valueType: 'multiple',
        required: 0,
        sortOrder: 30,
        values: ['通勤', '运动', '户外', '休闲', '旅行']
      }
    ]
  },
  {
    categoryName: '美妆个护',
    name: '护肤个护模板',
    description: '适用于精华、面霜、洁面、洗护等美妆个护商品。',
    icon: 'sparkles',
    sortOrder: 10,
    attributes: [
      {
        name: '规格',
        key: 'volume',
        description: '常见容量规格',
        valueType: 'single',
        required: 1,
        sortOrder: 10,
        values: ['30ml', '50ml', '75ml', '100ml', '150ml']
      },
      {
        name: '适用肤质',
        key: 'skin_type',
        description: '适用肤质',
        valueType: 'multiple',
        required: 0,
        sortOrder: 20,
        values: ['干皮', '油皮', '混合皮', '敏感肌', '通用']
      },
      {
        name: '核心功效',
        key: 'effect',
        description: '产品主打功效',
        valueType: 'multiple',
        required: 0,
        sortOrder: 30,
        values: ['补水', '修护', '控油', '舒缓', '提亮']
      }
    ]
  },
  {
    categoryName: '美妆个护',
    name: '彩妆模板',
    description: '适用于口红、粉底、眼影、腮红等彩妆商品。',
    icon: 'palette',
    sortOrder: 20,
    attributes: [
      {
        name: '色号',
        key: 'shade',
        description: '常用色号或色系',
        valueType: 'single',
        required: 1,
        sortOrder: 10,
        values: ['冷调粉', '暖调橘', '豆沙色', '正红色', '自然色']
      },
      {
        name: '妆效',
        key: 'finish',
        description: '上妆后的妆感',
        valueType: 'single',
        required: 0,
        sortOrder: 20,
        values: ['雾面', '光泽', '水润', '自然']
      },
      {
        name: '适用肤色',
        key: 'skin_tone',
        description: '推荐肤色',
        valueType: 'multiple',
        required: 0,
        sortOrder: 30,
        values: ['冷白皮', '自然肤色', '健康肤色', '黄一白']
      }
    ]
  },
  {
    categoryName: '防晒',
    name: '防晒模板',
    description: '适用于防晒霜、防晒喷雾、防晒乳等商品。',
    icon: 'sun',
    sortOrder: 10,
    attributes: [
      {
        name: 'SPF',
        key: 'spf',
        description: '防晒指数',
        valueType: 'single',
        required: 1,
        sortOrder: 10,
        values: ['SPF30', 'SPF35', 'SPF50', 'SPF50+']
      },
      {
        name: 'PA等级',
        key: 'pa',
        description: 'UVA防护等级',
        valueType: 'single',
        required: 1,
        sortOrder: 20,
        values: ['PA++', 'PA+++', 'PA++++']
      },
      {
        name: '质地',
        key: 'texture',
        description: '产品质地类型',
        valueType: 'single',
        required: 0,
        sortOrder: 30,
        values: ['乳液', '啫喱', '喷雾', '防晒棒']
      }
    ]
  },
  {
    categoryName: '数码家电',
    name: '手机数码模板',
    description: '适用于手机、平板、耳机等数码类商品。',
    icon: 'smartphone',
    sortOrder: 10,
    attributes: [
      {
        name: '存储容量',
        key: 'storage',
        description: '常见存储版本',
        valueType: 'single',
        required: 1,
        sortOrder: 10,
        values: ['64GB', '128GB', '256GB', '512GB', '1TB']
      },
      {
        name: '颜色',
        key: 'color',
        description: '机身颜色',
        valueType: 'single',
        required: 0,
        sortOrder: 20,
        values: ['黑色', '白色', '银色', '蓝色', '绿色']
      },
      {
        name: '网络版本',
        key: 'network',
        description: '支持的网络版本',
        valueType: 'single',
        required: 0,
        sortOrder: 30,
        values: ['4G', '5G', 'Wi-Fi']
      }
    ]
  },
  {
    categoryName: '数码家电',
    name: '小家电模板',
    description: '适用于风扇、吹风机、破壁机等小家电商品。',
    icon: 'zap',
    sortOrder: 20,
    attributes: [
      {
        name: '颜色',
        key: 'color',
        description: '产品颜色',
        valueType: 'single',
        required: 0,
        sortOrder: 10,
        values: ['白色', '黑色', '银色', '奶油色']
      },
      {
        name: '功率',
        key: 'power',
        description: '额定功率',
        valueType: 'custom',
        required: 0,
        sortOrder: 20,
        values: []
      },
      {
        name: '适用场景',
        key: 'scene',
        description: '适合使用场景',
        valueType: 'multiple',
        required: 0,
        sortOrder: 30,
        values: ['宿舍', '办公', '居家', '旅行']
      }
    ]
  },
  {
    categoryName: '家居生活',
    name: '家居日用模板',
    description: '适用于收纳、清洁、厨房和日用家居商品。',
    icon: 'home',
    sortOrder: 10,
    attributes: [
      {
        name: '颜色',
        key: 'color',
        description: '常用配色',
        valueType: 'single',
        required: 0,
        sortOrder: 10,
        values: ['白色', '灰色', '米色', '透明', '原木色']
      },
      {
        name: '材质',
        key: 'material',
        description: '商品材质',
        valueType: 'single',
        required: 0,
        sortOrder: 20,
        values: ['塑料', '金属', '玻璃', '木质', '布艺']
      },
      {
        name: '规格',
        key: 'spec',
        description: '尺寸或容量',
        valueType: 'custom',
        required: 0,
        sortOrder: 30,
        values: []
      }
    ]
  },
  {
    categoryName: '食品饮料',
    name: '零食冲饮模板',
    description: '适用于零食、咖啡、茶饮、速食等食品饮料商品。',
    icon: 'cup-soda',
    sortOrder: 10,
    attributes: [
      {
        name: '口味',
        key: 'flavor',
        description: '商品风味',
        valueType: 'single',
        required: 1,
        sortOrder: 10,
        values: ['原味', '巧克力', '抹茶', '草莓', '香辣']
      },
      {
        name: '包装规格',
        key: 'pack_size',
        description: '售卖组合',
        valueType: 'single',
        required: 1,
        sortOrder: 20,
        values: ['单件装', '3件装', '6件装', '12件装']
      },
      {
        name: '净含量',
        key: 'net_weight',
        description: '商品净含量',
        valueType: 'custom',
        required: 0,
        sortOrder: 30,
        values: []
      }
    ]
  },
  {
    categoryName: '运动户外',
    name: '运动户外模板',
    description: '适用于运动服饰、露营和户外装备商品。',
    icon: 'mountain',
    sortOrder: 10,
    attributes: [
      {
        name: '颜色',
        key: 'color',
        description: '商品颜色',
        valueType: 'single',
        required: 0,
        sortOrder: 10,
        values: ['黑色', '白色', '军绿色', '橙色', '蓝色']
      },
      {
        name: '尺码/容量',
        key: 'size_or_capacity',
        description: '服饰尺码或装备容量',
        valueType: 'single',
        required: 0,
        sortOrder: 20,
        values: ['S', 'M', 'L', '20L', '30L', '40L']
      },
      {
        name: '适用季节',
        key: 'season',
        description: '推荐季节',
        valueType: 'single',
        required: 0,
        sortOrder: 30,
        values: ['春夏', '秋冬', '四季通用']
      }
    ]
  },
  {
    categoryName: '母婴玩具',
    name: '母婴玩具模板',
    description: '适用于母婴用品、儿童玩具和早教商品。',
    icon: 'baby',
    sortOrder: 10,
    attributes: [
      {
        name: '适用年龄',
        key: 'age_group',
        description: '适用年龄段',
        valueType: 'single',
        required: 1,
        sortOrder: 10,
        values: ['0-6个月', '6-12个月', '1-3岁', '3-6岁', '6岁+']
      },
      {
        name: '包装规格',
        key: 'pack_size',
        description: '售卖规格',
        valueType: 'single',
        required: 0,
        sortOrder: 20,
        values: ['单件装', '2件装', '4件装']
      },
      {
        name: '材质',
        key: 'material',
        description: '商品材质说明',
        valueType: 'custom',
        required: 0,
        sortOrder: 30,
        values: []
      }
    ]
  },
  {
    categoryName: '其他',
    name: '通用模板',
    description: '当商品暂时没有更合适模板时可先使用的通用模板。',
    icon: 'box',
    sortOrder: 10,
    attributes: [
      {
        name: '颜色',
        key: 'color',
        description: '商品颜色',
        valueType: 'single',
        required: 0,
        sortOrder: 10,
        values: ['黑色', '白色', '灰色', '蓝色', '红色']
      },
      {
        name: '规格',
        key: 'spec',
        description: '商品尺寸、重量或容量',
        valueType: 'custom',
        required: 0,
        sortOrder: 20,
        values: []
      },
      {
        name: '适用人群',
        key: 'audience',
        description: '目标使用人群',
        valueType: 'single',
        required: 0,
        sortOrder: 30,
        values: ['通用', '男士', '女士', '儿童']
      }
    ]
  }
];

async function createAttributeValues(connection, attributeId, values) {
  if (!values || values.length === 0) {
    return;
  }

  const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const params = [];
  values.forEach((value, index) => {
    const text = String(value).trim();
    params.push(attributeId, text, text, index + 1, 1);
  });

  await connection.query(
    `INSERT INTO product_attribute_values (attribute_id, value, label, sort_order, status)
     VALUES ${placeholders}`,
    params
  );
}

async function createTemplate(connection, categoryId, template) {
  const [typeResult] = await connection.query(
    `INSERT INTO product_types (category_id, name, description, icon, sort_order, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [categoryId, template.name, template.description, template.icon, template.sortOrder]
  );

  for (const attribute of template.attributes) {
    const [attributeResult] = await connection.query(
      `INSERT INTO product_attributes (
        product_type_id, name, attribute_key, description, value_type, is_required, sort_order, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [
        typeResult.insertId,
        attribute.name,
        attribute.key,
        attribute.description,
        attribute.valueType,
        attribute.required,
        attribute.sortOrder
      ]
    );

    await createAttributeValues(connection, attributeResult.insertId, attribute.values);
  }
}

async function main() {
  const connection = await mallPool.getConnection();

  try {
    console.log('[spec-seed] start');
    await connection.beginTransaction();

    const [categoryRows] = await connection.query(
      'SELECT id, name FROM categories WHERE status = 1'
    );
    const categoryMap = new Map(categoryRows.map((row) => [row.name, row.id]));

    for (const template of TEMPLATE_SEEDS) {
      if (!categoryMap.has(template.categoryName)) {
        throw new Error(`未找到分类: ${template.categoryName}`);
      }
    }

    await connection.query('UPDATE products SET product_type_id = NULL WHERE product_type_id IS NOT NULL');
    await connection.query('DELETE FROM product_types');

    let templateCount = 0;
    let attributeCount = 0;
    let valueCount = 0;

    for (const template of TEMPLATE_SEEDS) {
      await createTemplate(connection, categoryMap.get(template.categoryName), template);
      templateCount += 1;
      attributeCount += template.attributes.length;
      valueCount += template.attributes.reduce((sum, attribute) => sum + attribute.values.length, 0);
    }

    await connection.commit();
    console.log(`[spec-seed] done templates=${templateCount} attributes=${attributeCount} values=${valueCount}`);
  } catch (error) {
    await connection.rollback();
    console.error('[spec-seed] failed:', error);
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
