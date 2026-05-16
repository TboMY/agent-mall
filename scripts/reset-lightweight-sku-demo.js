require('dotenv').config();

const { mallPool, closePools } = require('../config/database');
const Product = require('../models/Product');

async function ensureBrand(connection, name) {
  const [rows] = await connection.query(
    'SELECT id FROM brands WHERE name = ? LIMIT 1',
    [name]
  );
  if (rows[0]) {
    return rows[0].id;
  }

  const [result] = await connection.query(
    `INSERT INTO brands (name, description, status, created_at, updated_at)
     VALUES (?, ?, 1, NOW(), NOW())`,
    [name, `${name} 示例品牌`]
  );
  return result.insertId;
}

async function getCategoryId(connection, name) {
  const [rows] = await connection.query(
    'SELECT id FROM categories WHERE name = ? LIMIT 1',
    [name]
  );
  if (!rows[0]) {
    throw new Error(`未找到分类：${name}`);
  }
  return rows[0].id;
}

async function getProductTypeId(connection, name) {
  const [rows] = await connection.query(
    'SELECT id FROM product_types WHERE name = ? LIMIT 1',
    [name]
  );
  if (!rows[0]) {
    throw new Error(`未找到规格模板：${name}`);
  }
  return rows[0].id;
}

async function getAttributeCatalog(connection, productTypeId) {
  const [attributeRows] = await connection.query(
    `SELECT id, name, attribute_key
     FROM product_attributes
     WHERE product_type_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [productTypeId]
  );

  const [valueRows] = await connection.query(
    `SELECT pav.id, pav.attribute_id, COALESCE(NULLIF(pav.label, ''), pav.value) AS text
     FROM product_attribute_values pav
     INNER JOIN product_attributes pa ON pa.id = pav.attribute_id
     WHERE pa.product_type_id = ?
     ORDER BY pav.sort_order ASC, pav.id ASC`,
    [productTypeId]
  );

  const valuesByAttribute = valueRows.reduce((acc, row) => {
    if (!acc[row.attribute_id]) acc[row.attribute_id] = [];
    acc[row.attribute_id].push(row);
    return acc;
  }, {});

  return attributeRows.map((attribute) => ({
    ...attribute,
    values: valuesByAttribute[attribute.id] || []
  }));
}

function findAttribute(attributes, key) {
  return attributes.find((item) => item.attribute_key === key);
}

function findValueId(attribute, text) {
  if (!attribute) return null;
  const matched = attribute.values.find((item) => item.text === text);
  return matched ? matched.id : null;
}

async function resetCommerceData(connection) {
  await connection.query('DELETE FROM order_items');
  await connection.query('DELETE FROM orders');
  await connection.query('DELETE FROM cart_items');
  await connection.query('DELETE FROM product_sku_specs');
  await connection.query('DELETE FROM product_skus');
  await connection.query('UPDATE ai_product_candidate SET linked_product_id = NULL, status = 0 WHERE linked_product_id IS NOT NULL');
  await connection.query('DELETE FROM product_recommendations');
  await connection.query('DELETE FROM products');
}

function buildSpec(attribute, text, customValue = '') {
  if (!attribute) return null;
  const valueId = findValueId(attribute, text);
  if (valueId) {
    return {
      attribute_id: attribute.id,
      attribute_value_id: valueId
    };
  }
  return {
    attribute_id: attribute.id,
    attribute_value_id: null,
    custom_value: customValue || text
  };
}

async function createDemoProduct(payload) {
  await Product.create(payload);
  console.log(`[sku-demo-reset] created ${payload.name}`);
}

async function main() {
  const connection = await mallPool.getConnection();

  try {
    console.log('[sku-demo-reset] start');
    await connection.beginTransaction();
    await resetCommerceData(connection);
    await connection.commit();
    connection.release();

    const seedConnection = await mallPool.getConnection();
    const digitalCategoryId = await getCategoryId(seedConnection, '数码家电');
    const sunscreenCategoryId = await getCategoryId(seedConnection, '防晒');
    const clothingCategoryId = await getCategoryId(seedConnection, '服饰鞋包');
    const beautyCategoryId = await getCategoryId(seedConnection, '美妆个护');
    const homeCategoryId = await getCategoryId(seedConnection, '家居生活');
    const foodCategoryId = await getCategoryId(seedConnection, '食品饮料');
    const outdoorCategoryId = await getCategoryId(seedConnection, '运动户外');
    const motherBabyCategoryId = await getCategoryId(seedConnection, '母婴玩具');

    const phoneTypeId = await getProductTypeId(seedConnection, '手机数码模板');
    const sunscreenTypeId = await getProductTypeId(seedConnection, '防晒模板');
    const shirtTypeId = await getProductTypeId(seedConnection, '休闲上衣模板');
    const skincareTypeId = await getProductTypeId(seedConnection, '护肤个护模板');
    const applianceTypeId = await getProductTypeId(seedConnection, '小家电模板');
    const homeTypeId = await getProductTypeId(seedConnection, '家居日用模板');
    const snackTypeId = await getProductTypeId(seedConnection, '零食冲饮模板');
    const outdoorTypeId = await getProductTypeId(seedConnection, '运动户外模板');
    const motherBabyTypeId = await getProductTypeId(seedConnection, '母婴玩具模板');

    const xiaomiBrandId = await ensureBrand(seedConnection, '小米');
    const anessaBrandId = await ensureBrand(seedConnection, '安热沙');
    const uniqloBrandId = await ensureBrand(seedConnection, 'UNIQLO');
    const skiiBrandId = await ensureBrand(seedConnection, 'SK-II');
    const dysonBrandId = await ensureBrand(seedConnection, 'Dyson');
    const mujiBrandId = await ensureBrand(seedConnection, 'MUJI');
    const oatlyBrandId = await ensureBrand(seedConnection, 'OATLY');
    const keepBrandId = await ensureBrand(seedConnection, 'Keep');
    const aptamilBrandId = await ensureBrand(seedConnection, 'Aptamil');
    const naturehikeBrandId = await ensureBrand(seedConnection, 'Naturehike');
    const bearBrandId = await ensureBrand(seedConnection, '小熊电器');
    const threeSquirrelsBrandId = await ensureBrand(seedConnection, '三只松鼠');
    const bananainBrandId = await ensureBrand(seedConnection, '蕉下');

    const phoneAttrs = await getAttributeCatalog(seedConnection, phoneTypeId);
    const sunscreenAttrs = await getAttributeCatalog(seedConnection, sunscreenTypeId);
    const shirtAttrs = await getAttributeCatalog(seedConnection, shirtTypeId);
    const skincareAttrs = await getAttributeCatalog(seedConnection, skincareTypeId);
    const applianceAttrs = await getAttributeCatalog(seedConnection, applianceTypeId);
    const homeAttrs = await getAttributeCatalog(seedConnection, homeTypeId);
    const snackAttrs = await getAttributeCatalog(seedConnection, snackTypeId);
    const outdoorAttrs = await getAttributeCatalog(seedConnection, outdoorTypeId);
    const motherBabyAttrs = await getAttributeCatalog(seedConnection, motherBabyTypeId);
    seedConnection.release();

    const storageAttr = findAttribute(phoneAttrs, 'storage');
    const phoneColorAttr = findAttribute(phoneAttrs, 'color');
    const networkAttr = findAttribute(phoneAttrs, 'network');
    const spfAttr = findAttribute(sunscreenAttrs, 'spf');
    const paAttr = findAttribute(sunscreenAttrs, 'pa');
    const textureAttr = findAttribute(sunscreenAttrs, 'texture');
    const shirtSizeAttr = findAttribute(shirtAttrs, 'size');
    const shirtColorAttr = findAttribute(shirtAttrs, 'color');
    const shirtMaterialAttr = findAttribute(shirtAttrs, 'material');
    const skincareVolumeAttr = findAttribute(skincareAttrs, 'volume');
    const skincareSkinTypeAttr = findAttribute(skincareAttrs, 'skin_type');
    const skincareEffectAttr = findAttribute(skincareAttrs, 'effect');
    const applianceColorAttr = findAttribute(applianceAttrs, 'color');
    const appliancePowerAttr = findAttribute(applianceAttrs, 'power');
    const homeColorAttr = findAttribute(homeAttrs, 'color');
    const homeMaterialAttr = findAttribute(homeAttrs, 'material');
    const homeSpecAttr = findAttribute(homeAttrs, 'spec');
    const snackFlavorAttr = findAttribute(snackAttrs, 'flavor');
    const snackPackAttr = findAttribute(snackAttrs, 'pack_size');
    const snackWeightAttr = findAttribute(snackAttrs, 'net_weight');
    const outdoorColorAttr = findAttribute(outdoorAttrs, 'color');
    const outdoorSizeAttr = findAttribute(outdoorAttrs, 'size_or_capacity');
    const outdoorSeasonAttr = findAttribute(outdoorAttrs, 'season');
    const babyAgeAttr = findAttribute(motherBabyAttrs, 'age_group');
    const babyPackAttr = findAttribute(motherBabyAttrs, 'pack_size');
    const babyMaterialAttr = findAttribute(motherBabyAttrs, 'material');

    await createDemoProduct({
      name: '小米15 Pro',
      description: '用于后台 SKU 演示的数码商品，支持多存储版本。',
      image: 'https://res.vmallres.com/uomcdn/CN/cms/202510/5d00775d54ce4a9ca5b353a7f1c54018.jpg',
      images: ['https://res.vmallres.com/uomcdn/CN/cms/202510/5d00775d54ce4a9ca5b353a7f1c54018.jpg'],
      category_id: digitalCategoryId,
      brand_id: xiaomiBrandId,
      product_type_id: phoneTypeId,
      heat_score: 88,
      is_ai_recommended: false,
      ai_recommendation: '',
      source_platform: '',
      source_url: '',
      tags: ['数码', '手机'],
      status: 1,
      skus: [
        {
          sku_code: 'MI15PRO-12-256-BLACK',
          sku_name: '12GB+256GB 黑色',
          price: 4999,
          original_price: 5299,
          stock: 12,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            { attribute_id: storageAttr?.id, attribute_value_id: findValueId(storageAttr, '256GB') },
            { attribute_id: phoneColorAttr?.id, attribute_value_id: findValueId(phoneColorAttr, '黑色') },
            { attribute_id: networkAttr?.id, attribute_value_id: findValueId(networkAttr, '5G') }
          ].filter((item) => item.attribute_id && item.attribute_value_id)
        },
        {
          sku_code: 'MI15PRO-16-512-SILVER',
          sku_name: '16GB+512GB 银色',
          price: 5699,
          original_price: 5999,
          stock: 8,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            { attribute_id: storageAttr?.id, attribute_value_id: findValueId(storageAttr, '512GB') },
            { attribute_id: phoneColorAttr?.id, attribute_value_id: findValueId(phoneColorAttr, '银色') },
            { attribute_id: networkAttr?.id, attribute_value_id: findValueId(networkAttr, '5G') }
          ].filter((item) => item.attribute_id && item.attribute_value_id)
        }
      ]
    });

    await createDemoProduct({
      name: '安热沙金灿防晒乳',
      description: '用于后台 SKU 演示的防晒商品，按容量区分不同 SKU。',
      image: 'https://img.alicdn.com/imgextra/i4/2200676927391/O1CN01demoSunscreen.jpg',
      images: ['https://img.alicdn.com/imgextra/i4/2200676927391/O1CN01demoSunscreen.jpg'],
      category_id: sunscreenCategoryId,
      brand_id: anessaBrandId,
      product_type_id: sunscreenTypeId,
      heat_score: 92,
      is_ai_recommended: true,
      ai_recommendation: '夏季防晒场景稳定，适合做容量差异化SKU。',
      source_platform: 'douyin',
      source_url: 'https://www.douyin.com/',
      tags: ['防晒', '夏季'],
      status: 1,
      skus: [
        {
          sku_code: 'ANESSA-60ML',
          sku_name: '60ml 标准装',
          price: 119,
          original_price: 139,
          stock: 20,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            { attribute_id: spfAttr?.id, attribute_value_id: findValueId(spfAttr, 'SPF50+') },
            { attribute_id: paAttr?.id, attribute_value_id: findValueId(paAttr, 'PA++++') },
            { attribute_id: textureAttr?.id, attribute_value_id: findValueId(textureAttr, '乳液') }
          ].filter((item) => item.attribute_id && item.attribute_value_id)
        },
        {
          sku_code: 'ANESSA-90ML',
          sku_name: '90ml 家庭装',
          price: 169,
          original_price: 189,
          stock: 14,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            { attribute_id: spfAttr?.id, attribute_value_id: findValueId(spfAttr, 'SPF50+') },
            { attribute_id: paAttr?.id, attribute_value_id: findValueId(paAttr, 'PA++++') },
            { attribute_id: textureAttr?.id, attribute_value_id: findValueId(textureAttr, '乳液') }
          ].filter((item) => item.attribute_id && item.attribute_value_id)
        }
      ]
    });

    await createDemoProduct({
      name: '纯棉基础短袖T恤',
      description: '用于后台 SKU 演示的服饰商品，按尺码和颜色展示不同 SKU。',
      image: 'https://img.alicdn.com/imgextra/i2/2200676927391/O1CN01demoShirt.jpg',
      images: ['https://img.alicdn.com/imgextra/i2/2200676927391/O1CN01demoShirt.jpg'],
      category_id: clothingCategoryId,
      brand_id: uniqloBrandId,
      product_type_id: shirtTypeId,
      heat_score: 75,
      is_ai_recommended: false,
      ai_recommendation: '',
      source_platform: '',
      source_url: '',
      tags: ['服饰', 'T恤'],
      status: 1,
      skus: [
        {
          sku_code: 'TEE-WHITE-M',
          sku_name: '白色 M',
          price: 79,
          original_price: 99,
          stock: 18,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(shirtSizeAttr, 'M'),
            buildSpec(shirtColorAttr, '白色'),
            buildSpec(shirtMaterialAttr, '100%纯棉')
          ].filter(Boolean)
        },
        {
          sku_code: 'TEE-BLACK-L',
          sku_name: '黑色 L',
          price: 79,
          original_price: 99,
          stock: 10,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(shirtSizeAttr, 'L'),
            buildSpec(shirtColorAttr, '黑色'),
            buildSpec(shirtMaterialAttr, '100%纯棉')
          ].filter(Boolean)
        }
      ]
    });

    await createDemoProduct({
      name: 'SK-II 神仙水精华液',
      description: '经典精华水，主打细腻肤感与稳定修护，适合首页美妆推荐区展示。',
      image: 'https://img.alicdn.com/imgextra/i3/2200676927391/O1CN01demoSKII.jpg',
      images: ['https://img.alicdn.com/imgextra/i3/2200676927391/O1CN01demoSKII.jpg'],
      category_id: beautyCategoryId,
      brand_id: skiiBrandId,
      product_type_id: skincareTypeId,
      heat_score: 94,
      is_ai_recommended: true,
      ai_recommendation: '高认知度护肤单品，适合作为首页高热度推荐商品。',
      source_platform: 'bilibili',
      source_url: 'https://www.bilibili.com/',
      tags: ['精华水', '护肤'],
      status: 1,
      skus: [
        {
          sku_code: 'SKII-75ML',
          sku_name: '75ml 体验装',
          price: 690,
          original_price: 750,
          stock: 16,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(skincareVolumeAttr, '75ml'),
            buildSpec(skincareSkinTypeAttr, '通用'),
            buildSpec(skincareEffectAttr, '修护')
          ].filter(Boolean)
        },
        {
          sku_code: 'SKII-230ML',
          sku_name: '230ml 经典装',
          price: 1540,
          original_price: 1690,
          stock: 9,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(skincareVolumeAttr, '100ml', '230ml'),
            buildSpec(skincareSkinTypeAttr, '通用'),
            buildSpec(skincareEffectAttr, '提亮')
          ].filter(Boolean)
        }
      ]
    });

    await createDemoProduct({
      name: '戴森 Supersonic 吹风机',
      description: '高风速护发吹风机，兼顾颜值与使用体验，适合首页数码家电板块。',
      image: 'https://img.alicdn.com/imgextra/i1/2200676927391/O1CN01demoDyson.jpg',
      images: ['https://img.alicdn.com/imgextra/i1/2200676927391/O1CN01demoDyson.jpg'],
      category_id: digitalCategoryId,
      brand_id: dysonBrandId,
      product_type_id: applianceTypeId,
      heat_score: 89,
      is_ai_recommended: true,
      ai_recommendation: '高客单小家电，品牌辨识度强，适合作为首页品质推荐。',
      source_platform: 'douyin',
      source_url: 'https://www.douyin.com/',
      tags: ['吹风机', '小家电'],
      status: 1,
      skus: [
        {
          sku_code: 'DYSON-HD15-SILVER',
          sku_name: '银灰色 标准版',
          price: 3299,
          original_price: 3599,
          stock: 7,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(applianceColorAttr, '银色'),
            buildSpec(appliancePowerAttr, '1600W')
          ].filter(Boolean)
        },
        {
          sku_code: 'DYSON-HD15-BLACK',
          sku_name: '黑金色 礼盒版',
          price: 3599,
          original_price: 3899,
          stock: 5,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(applianceColorAttr, '黑色'),
            buildSpec(appliancePowerAttr, '1600W')
          ].filter(Boolean)
        }
      ]
    });

    await createDemoProduct({
      name: 'MUJI 折叠收纳箱',
      description: '家居收纳高频单品，适合做首页生活方式场景展示。',
      image: 'https://img.alicdn.com/imgextra/i1/2200676927391/O1CN01demoMuji.jpg',
      images: ['https://img.alicdn.com/imgextra/i1/2200676927391/O1CN01demoMuji.jpg'],
      category_id: homeCategoryId,
      brand_id: mujiBrandId,
      product_type_id: homeTypeId,
      heat_score: 76,
      is_ai_recommended: false,
      ai_recommendation: '',
      source_platform: '',
      source_url: '',
      tags: ['收纳', '家居'],
      status: 1,
      skus: [
        {
          sku_code: 'MUJI-BOX-S',
          sku_name: '浅灰色 30L',
          price: 69,
          original_price: 89,
          stock: 24,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(homeColorAttr, '灰色'),
            buildSpec(homeMaterialAttr, '塑料'),
            buildSpec(homeSpecAttr, '30L')
          ].filter(Boolean)
        },
        {
          sku_code: 'MUJI-BOX-L',
          sku_name: '米白色 55L',
          price: 99,
          original_price: 129,
          stock: 18,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(homeColorAttr, '米色'),
            buildSpec(homeMaterialAttr, '塑料'),
            buildSpec(homeSpecAttr, '55L')
          ].filter(Boolean)
        }
      ]
    });

    await createDemoProduct({
      name: 'OATLY 咖啡大师燕麦奶',
      description: '热门植物基饮品，适合首页饮品推荐和日常回购场景。',
      image: 'https://img.alicdn.com/imgextra/i4/2200676927391/O1CN01demoOatly.jpg',
      images: ['https://img.alicdn.com/imgextra/i4/2200676927391/O1CN01demoOatly.jpg'],
      category_id: foodCategoryId,
      brand_id: oatlyBrandId,
      product_type_id: snackTypeId,
      heat_score: 83,
      is_ai_recommended: true,
      ai_recommendation: '具备高复购与内容传播属性，适合作为食品饮料代表商品。',
      source_platform: 'xiaohongshu',
      source_url: '',
      tags: ['饮品', '燕麦奶'],
      status: 1,
      skus: [
        {
          sku_code: 'OATLY-6PK',
          sku_name: '原味 6盒装',
          price: 49.9,
          original_price: 59.9,
          stock: 30,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(snackFlavorAttr, '原味'),
            buildSpec(snackPackAttr, '6件装'),
            buildSpec(snackWeightAttr, '1L*6')
          ].filter(Boolean)
        },
        {
          sku_code: 'OATLY-12PK',
          sku_name: '原味 12盒装',
          price: 92,
          original_price: 108,
          stock: 20,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(snackFlavorAttr, '原味'),
            buildSpec(snackPackAttr, '12件装'),
            buildSpec(snackWeightAttr, '1L*12')
          ].filter(Boolean)
        }
      ]
    });

    await createDemoProduct({
      name: 'Keep 速干运动短裤',
      description: '夏季运动穿搭高频商品，适合前台分类会场和新品区展示。',
      image: 'https://img.alicdn.com/imgextra/i3/2200676927391/O1CN01demoKeep.jpg',
      images: ['https://img.alicdn.com/imgextra/i3/2200676927391/O1CN01demoKeep.jpg'],
      category_id: outdoorCategoryId,
      brand_id: keepBrandId,
      product_type_id: outdoorTypeId,
      heat_score: 78,
      is_ai_recommended: false,
      ai_recommendation: '',
      source_platform: '',
      source_url: '',
      tags: ['运动', '短裤'],
      status: 1,
      skus: [
        {
          sku_code: 'KEEP-SHORTS-BLACK-M',
          sku_name: '黑色 M',
          price: 129,
          original_price: 159,
          stock: 21,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(outdoorColorAttr, '黑色'),
            buildSpec(outdoorSizeAttr, 'M'),
            buildSpec(outdoorSeasonAttr, '春夏')
          ].filter(Boolean)
        },
        {
          sku_code: 'KEEP-SHORTS-BLUE-L',
          sku_name: '蓝色 L',
          price: 129,
          original_price: 159,
          stock: 14,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(outdoorColorAttr, '蓝色'),
            buildSpec(outdoorSizeAttr, 'L'),
            buildSpec(outdoorSeasonAttr, '春夏')
          ].filter(Boolean)
        }
      ]
    });

    await createDemoProduct({
      name: 'Aptamil 婴幼儿奶粉',
      description: '母婴高频囤货商品，适合让前台商城更完整。',
      image: 'https://img.alicdn.com/imgextra/i1/2200676927391/O1CN01demoAptamil.jpg',
      images: ['https://img.alicdn.com/imgextra/i1/2200676927391/O1CN01demoAptamil.jpg'],
      category_id: motherBabyCategoryId,
      brand_id: aptamilBrandId,
      product_type_id: motherBabyTypeId,
      heat_score: 85,
      is_ai_recommended: false,
      ai_recommendation: '',
      source_platform: '',
      source_url: '',
      tags: ['母婴', '奶粉'],
      status: 1,
      skus: [
        {
          sku_code: 'APTAMIL-1-STAGE',
          sku_name: '1段 800g 单罐',
          price: 268,
          original_price: 298,
          stock: 16,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(babyAgeAttr, '0-6个月'),
            buildSpec(babyPackAttr, '单件装'),
            buildSpec(babyMaterialAttr, '金属罐装')
          ].filter(Boolean)
        },
        {
          sku_code: 'APTAMIL-2-STAGE',
          sku_name: '2段 800g 双罐',
          price: 518,
          original_price: 568,
          stock: 10,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(babyAgeAttr, '6-12个月'),
            buildSpec(babyPackAttr, '2件装'),
            buildSpec(babyMaterialAttr, '金属罐装')
          ].filter(Boolean)
        }
      ]
    });

    await createDemoProduct({
      name: 'Naturehike 露营折叠月亮椅',
      description: '轻量露营热门单品，适合作为运动户外分类的氛围商品。',
      image: 'https://img.alicdn.com/imgextra/i2/2200676927391/O1CN01demoCampChair.jpg',
      images: ['https://img.alicdn.com/imgextra/i2/2200676927391/O1CN01demoCampChair.jpg'],
      category_id: outdoorCategoryId,
      brand_id: naturehikeBrandId,
      product_type_id: outdoorTypeId,
      heat_score: 81,
      is_ai_recommended: true,
      ai_recommendation: '露营场景热度稳定，适合作为户外会场代表商品。',
      source_platform: 'bilibili',
      source_url: 'https://www.bilibili.com/',
      tags: ['露营', '户外'],
      status: 1,
      skus: [
        {
          sku_code: 'NH-CHAIR-GREEN',
          sku_name: '军绿色 标准款',
          price: 199,
          original_price: 239,
          stock: 19,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(outdoorColorAttr, '军绿色'),
            buildSpec(outdoorSizeAttr, '30L', '标准尺寸'),
            buildSpec(outdoorSeasonAttr, '四季通用')
          ].filter(Boolean)
        },
        {
          sku_code: 'NH-CHAIR-BLACK',
          sku_name: '黑色 加宽款',
          price: 239,
          original_price: 279,
          stock: 12,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(outdoorColorAttr, '黑色'),
            buildSpec(outdoorSizeAttr, '40L', '加宽尺寸'),
            buildSpec(outdoorSeasonAttr, '四季通用')
          ].filter(Boolean)
        }
      ]
    });

    await createDemoProduct({
      name: '小熊 便携挂烫机',
      description: '旅行和通勤场景下常见的小家电商品，适合首页家电推荐位。',
      image: 'https://img.alicdn.com/imgextra/i1/2200676927391/O1CN01demoBearIron.jpg',
      images: ['https://img.alicdn.com/imgextra/i1/2200676927391/O1CN01demoBearIron.jpg'],
      category_id: digitalCategoryId,
      brand_id: bearBrandId,
      product_type_id: applianceTypeId,
      heat_score: 73,
      is_ai_recommended: false,
      ai_recommendation: '',
      source_platform: '',
      source_url: '',
      tags: ['挂烫机', '小家电'],
      status: 1,
      skus: [
        {
          sku_code: 'BEAR-IRON-WHITE',
          sku_name: '白色 便携款',
          price: 159,
          original_price: 199,
          stock: 23,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(applianceColorAttr, '白色'),
            buildSpec(appliancePowerAttr, '1000W')
          ].filter(Boolean)
        },
        {
          sku_code: 'BEAR-IRON-CREAM',
          sku_name: '奶油色 升级款',
          price: 199,
          original_price: 239,
          stock: 15,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(applianceColorAttr, '奶油色'),
            buildSpec(appliancePowerAttr, '1200W')
          ].filter(Boolean)
        }
      ]
    });

    await createDemoProduct({
      name: '三只松鼠 冻干酸奶块',
      description: '适合首页零食区与凑单推荐区展示的轻零食商品。',
      image: 'https://img.alicdn.com/imgextra/i2/2200676927391/O1CN01demoSnack.jpg',
      images: ['https://img.alicdn.com/imgextra/i2/2200676927391/O1CN01demoSnack.jpg'],
      category_id: foodCategoryId,
      brand_id: threeSquirrelsBrandId,
      product_type_id: snackTypeId,
      heat_score: 69,
      is_ai_recommended: false,
      ai_recommendation: '',
      source_platform: '',
      source_url: '',
      tags: ['零食', '酸奶块'],
      status: 1,
      skus: [
        {
          sku_code: '3SQ-YOGURT-STRAWBERRY',
          sku_name: '草莓味 3袋装',
          price: 29.9,
          original_price: 36.9,
          stock: 40,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(snackFlavorAttr, '草莓'),
            buildSpec(snackPackAttr, '3件装'),
            buildSpec(snackWeightAttr, '18g*3')
          ].filter(Boolean)
        },
        {
          sku_code: '3SQ-YOGURT-ORIGINAL',
          sku_name: '原味 6袋装',
          price: 49.9,
          original_price: 59.9,
          stock: 28,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(snackFlavorAttr, '原味'),
            buildSpec(snackPackAttr, '6件装'),
            buildSpec(snackWeightAttr, '18g*6')
          ].filter(Boolean)
        }
      ]
    });

    await createDemoProduct({
      name: '蕉下 冰感防晒袖套',
      description: '夏季出行高频防晒单品，适合首页热卖和防晒专题区。',
      image: 'https://img.alicdn.com/imgextra/i2/2200676927391/O1CN01demoBananaIn.jpg',
      images: ['https://img.alicdn.com/imgextra/i2/2200676927391/O1CN01demoBananaIn.jpg'],
      category_id: sunscreenCategoryId,
      brand_id: bananainBrandId,
      product_type_id: sunscreenTypeId,
      heat_score: 87,
      is_ai_recommended: true,
      ai_recommendation: '应季性强，适合作为前台首页防晒会场的补充商品。',
      source_platform: 'douyin',
      source_url: 'https://www.douyin.com/',
      tags: ['防晒', '袖套'],
      status: 1,
      skus: [
        {
          sku_code: 'BANANAIN-SLEEVE-WHITE',
          sku_name: '白色 标准款',
          price: 59,
          original_price: 79,
          stock: 33,
          status: 1,
          is_default: 1,
          image: '',
          specs: [
            buildSpec(spfAttr, 'SPF50+'),
            buildSpec(paAttr, 'PA+++'),
            buildSpec(textureAttr, '防晒棒', '冰感面料')
          ].filter(Boolean)
        },
        {
          sku_code: 'BANANAIN-SLEEVE-PINK',
          sku_name: '粉色 加长款',
          price: 69,
          original_price: 89,
          stock: 21,
          status: 1,
          is_default: 0,
          image: '',
          specs: [
            buildSpec(spfAttr, 'SPF50+'),
            buildSpec(paAttr, 'PA+++'),
            buildSpec(textureAttr, '防晒棒', '加长冰感面料')
          ].filter(Boolean)
        }
      ]
    });

    console.log('[sku-demo-reset] done');
  } catch (error) {
    console.error('[sku-demo-reset] failed:', error);
    throw error;
  } finally {
    await closePools();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
