const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',
  CATEGORIES_MANAGE: 'categories.manage',
  BRANDS_MANAGE: 'brands.manage',
  PRODUCT_TYPES_MANAGE: 'productTypes.manage',
  PRODUCT_ATTRIBUTES_MANAGE: 'productAttributes.manage',
  AI_WORKBENCH_VIEW: 'aiWorkbench.view',
  AI_WORKBENCH_RUN: 'aiWorkbench.run',
  AI_CANDIDATES_REVIEW: 'aiCandidates.review',
  KEYWORD_TRENDS_MANAGE: 'keywordTrends.manage',
  SYSTEM_CONFIGS_MANAGE: 'systemConfigs.manage',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  MALL_USERS_VIEW: 'mallUsers.view',
  MALL_USERS_MANAGE: 'mallUsers.manage',
  ORDERS_VIEW: 'orders.view',
  ORDERS_MANAGE: 'orders.manage'
};

const PERMISSION_LABELS = {
  [PERMISSIONS.DASHBOARD_VIEW]: '查看仪表盘',
  [PERMISSIONS.PRODUCTS_VIEW]: '查看商品',
  [PERMISSIONS.PRODUCTS_MANAGE]: '管理商品',
  [PERMISSIONS.CATEGORIES_MANAGE]: '管理分类',
  [PERMISSIONS.BRANDS_MANAGE]: '管理品牌',
  [PERMISSIONS.PRODUCT_TYPES_MANAGE]: '管理商品类型',
  [PERMISSIONS.PRODUCT_ATTRIBUTES_MANAGE]: '管理商品属性',
  [PERMISSIONS.AI_WORKBENCH_VIEW]: '查看 AI 工作台',
  [PERMISSIONS.AI_WORKBENCH_RUN]: '执行 AI 选品任务',
  [PERMISSIONS.AI_CANDIDATES_REVIEW]: '审核 AI 候选商品',
  [PERMISSIONS.KEYWORD_TRENDS_MANAGE]: '管理热词与采集流水线',
  [PERMISSIONS.SYSTEM_CONFIGS_MANAGE]: '管理系统配置',
  [PERMISSIONS.USERS_MANAGE]: '管理后台账号',
  [PERMISSIONS.ROLES_MANAGE]: '管理后台角色',
  [PERMISSIONS.MALL_USERS_VIEW]: '查看商城用户',
  [PERMISSIONS.MALL_USERS_MANAGE]: '管理商城用户',
  [PERMISSIONS.ORDERS_VIEW]: '查看订单',
  [PERMISSIONS.ORDERS_MANAGE]: '管理订单'
};

const DEFAULT_ROLE_DEFINITIONS = [
  {
    code: 'super_admin',
    name: '超级管理员',
    description: '拥有全部后台权限',
    is_system: 1,
    status: 1,
    permissions: Object.values(PERMISSIONS)
  },
  {
    code: 'admin',
    name: '管理员',
    description: '负责商城和AI工作台管理',
    is_system: 1,
    status: 1,
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCTS_VIEW,
      PERMISSIONS.PRODUCTS_MANAGE,
      PERMISSIONS.CATEGORIES_MANAGE,
      PERMISSIONS.BRANDS_MANAGE,
      PERMISSIONS.PRODUCT_TYPES_MANAGE,
      PERMISSIONS.PRODUCT_ATTRIBUTES_MANAGE,
      PERMISSIONS.AI_WORKBENCH_VIEW,
      PERMISSIONS.AI_WORKBENCH_RUN,
      PERMISSIONS.AI_CANDIDATES_REVIEW,
      PERMISSIONS.KEYWORD_TRENDS_MANAGE,
      PERMISSIONS.SYSTEM_CONFIGS_MANAGE,
      PERMISSIONS.MALL_USERS_VIEW,
      PERMISSIONS.MALL_USERS_MANAGE,
      PERMISSIONS.ORDERS_VIEW,
      PERMISSIONS.ORDERS_MANAGE
    ]
  },
  {
    code: 'operator',
    name: '运营人员',
    description: '负责审核、查看与任务执行',
    is_system: 1,
    status: 1,
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCTS_VIEW,
      PERMISSIONS.AI_WORKBENCH_VIEW,
      PERMISSIONS.AI_WORKBENCH_RUN,
      PERMISSIONS.AI_CANDIDATES_REVIEW,
      PERMISSIONS.MALL_USERS_VIEW,
      PERMISSIONS.ORDERS_VIEW
    ]
  }
];

module.exports = {
  PERMISSIONS,
  PERMISSION_LABELS,
  DEFAULT_ROLE_DEFINITIONS
};
