const express = require('express');
const Joi = require('joi');

const UserAddress = require('../models/UserAddress');
const { validate } = require('../middleware/validation');
const { authenticateCustomer } = require('../middleware/customerAuth');

const router = express.Router();

const addressSchema = Joi.object({
  recipient_name: Joi.string().trim().min(2).max(50).required(),
  recipient_phone: Joi.string().trim().min(6).max(20).required(),
  province: Joi.string().trim().max(50).required(),
  city: Joi.string().trim().max(50).required(),
  district: Joi.string().trim().max(50).allow('', null),
  detail_address: Joi.string().trim().max(255).required(),
  postal_code: Joi.string().trim().max(20).allow('', null),
  is_default: Joi.number().integer().valid(0, 1).default(0)
});

router.use(authenticateCustomer);

router.get('/', async (req, res) => {
  try {
    const data = await UserAddress.listByUserId(req.customerAuth.user.id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取收货地址失败:', error);
    res.status(500).json({ success: false, message: '获取收货地址失败', error: error.message });
  }
});

router.post('/', validate(addressSchema), async (req, res) => {
  try {
    const id = await UserAddress.create(req.customerAuth.user.id, req.body);
    const data = await UserAddress.listByUserId(req.customerAuth.user.id);
    res.status(201).json({ success: true, message: '收货地址添加成功', data: { id, items: data } });
  } catch (error) {
    console.error('添加收货地址失败:', error);
    res.status(500).json({ success: false, message: '添加收货地址失败', error: error.message });
  }
});

router.put('/:id', validate(addressSchema), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: '无效的地址ID' });
    }

    const success = await UserAddress.update(id, req.customerAuth.user.id, req.body);
    if (!success) {
      return res.status(404).json({ success: false, message: '收货地址不存在' });
    }

    const data = await UserAddress.listByUserId(req.customerAuth.user.id);
    res.json({ success: true, message: '收货地址更新成功', data });
  } catch (error) {
    console.error('更新收货地址失败:', error);
    res.status(500).json({ success: false, message: '更新收货地址失败', error: error.message });
  }
});

router.post('/:id/default', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: '无效的地址ID' });
    }

    const success = await UserAddress.setDefault(id, req.customerAuth.user.id);
    if (!success) {
      return res.status(404).json({ success: false, message: '收货地址不存在' });
    }

    const data = await UserAddress.listByUserId(req.customerAuth.user.id);
    res.json({ success: true, message: '默认地址设置成功', data });
  } catch (error) {
    console.error('设置默认地址失败:', error);
    res.status(500).json({ success: false, message: '设置默认地址失败', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: '无效的地址ID' });
    }

    const success = await UserAddress.delete(id, req.customerAuth.user.id);
    if (!success) {
      return res.status(404).json({ success: false, message: '收货地址不存在' });
    }

    const data = await UserAddress.listByUserId(req.customerAuth.user.id);
    res.json({ success: true, message: '收货地址删除成功', data });
  } catch (error) {
    console.error('删除收货地址失败:', error);
    res.status(500).json({ success: false, message: '删除收货地址失败', error: error.message });
  }
});

module.exports = router;
