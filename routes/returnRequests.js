const express = require('express');

const ReturnRequest = require('../models/ReturnRequest');
const ReturnRequestService = require('../services/ReturnRequestService');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(requirePermission(PERMISSIONS.ORDERS_MANAGE));

/**
 * 后台退货申请列表。
 */
router.get('/', async (req, res) => {
  try {
    const result = await ReturnRequest.list({
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      search: req.query.search || '',
      status: req.query.status || ''
    });

    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取退货申请列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取退货申请列表失败',
      error: error.message
    });
  }
});

/**
 * 后台处理退货申请。
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const action = String(req.body.action || '').trim();
    const adminRemark = String(req.body.admin_remark || '').trim();

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: '无效的申请ID'
      });
    }

    if (action === 'approve') {
      await ReturnRequestService.approve(requestId, adminRemark);
    } else if (action === 'reject') {
      await ReturnRequestService.reject(requestId, adminRemark);
    } else {
      return res.status(400).json({
        success: false,
        message: '不支持的处理动作'
      });
    }

    const latest = await ReturnRequest.getById(requestId);
    res.json({
      success: true,
      message: action === 'approve' ? '已同意退款' : '已驳回申请',
      data: latest
    });
  } catch (error) {
    console.error('处理退货申请失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '处理退货申请失败'
    });
  }
});

module.exports = router;
