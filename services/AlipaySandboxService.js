const crypto = require('crypto');
const axios = require('axios');

function maskValue(value, visible = 6) {
  if (!value) return '';
  const text = String(value);
  if (text.length <= visible * 2) return text;
  return `${text.slice(0, visible)}***${text.slice(-visible)}`;
}

function wrapPem(key, type) {
  if (!key) return '';
  const trimmed = String(key).trim();
  if (trimmed.includes('BEGIN')) {
    return trimmed;
  }

  const lines = trimmed.match(/.{1,64}/g) || [];
  const header = type === 'private' ? 'PRIVATE KEY' : 'PUBLIC KEY';
  return `-----BEGIN ${header}-----\n${lines.join('\n')}\n-----END ${header}-----`;
}

class AlipaySandboxService {
  static getConfig() {
    return {
      enabled: String(process.env.ALIPAY_SANDBOX_ENABLED || 'false') === 'true',
      appId: process.env.ALIPAY_SANDBOX_APP_ID || '',
      gateway: process.env.ALIPAY_SANDBOX_GATEWAY || '',
      publicKey: wrapPem(process.env.ALIPAY_PUBLIC_KEY || '', 'public'),
      privateKey: wrapPem(process.env.ALIPAY_APP_PRIVATE_KEY || '', 'private'),
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
      returnUrl: process.env.ALIPAY_RETURN_URL || '',
      orderReturnUrl: process.env.ALIPAY_ORDER_RETURN_URL || process.env.ALIPAY_RETURN_URL || ''
    };
  }

  static getSafeConfigSnapshot() {
    const config = this.getConfig();
    return {
      enabled: config.enabled,
      appId: maskValue(config.appId, 4),
      gateway: config.gateway,
      notifyUrl: config.notifyUrl,
      returnUrl: config.returnUrl,
      orderReturnUrl: config.orderReturnUrl,
      hasPublicKey: Boolean(config.publicKey),
      hasPrivateKey: Boolean(config.privateKey)
    };
  }

  static buildCommonParams({ method, notifyUrl, returnUrl, bizContent }) {
    const config = this.assertEnabled();
    const timestamp = new Date(Date.now() + 8 * 3600 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    return {
      app_id: config.appId,
      method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp,
      version: '1.0',
      notify_url: notifyUrl || config.notifyUrl,
      return_url: returnUrl || config.returnUrl,
      biz_content: JSON.stringify(bizContent)
    };
  }

  static assertEnabled() {
    const config = this.getConfig();
    if (!config.enabled) {
      throw new Error('支付宝沙箱未启用');
    }
    if (!config.appId || !config.gateway || !config.publicKey || !config.privateKey) {
      throw new Error('支付宝沙箱配置不完整');
    }
    return config;
  }

  static buildSignContent(params) {
    return Object.keys(params)
      .filter((key) => key !== 'sign' && params[key] !== undefined && params[key] !== null && params[key] !== '')
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
  }

  static signParams(params) {
    const config = this.assertEnabled();
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(this.buildSignContent(params), 'utf8');
    signer.end();
    return signer.sign(config.privateKey, 'base64');
  }

  static verifyParams(params) {
    const config = this.assertEnabled();
    const sign = params.sign;
    if (!sign) {
      return false;
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(this.buildSignContent(params), 'utf8');
    verifier.end();
    return verifier.verify(config.publicKey, sign, 'base64');
  }

  static buildPagePayUrl(payload) {
    const config = this.assertEnabled();
    console.log('[alipay] build page pay url start', {
      orderNo: payload.order_no,
      amount: payload.amount,
      subject: payload.subject,
      config: this.getSafeConfigSnapshot()
    });
    const params = this.buildCommonParams({
      method: 'alipay.trade.page.pay',
      notifyUrl: payload.notify_url,
      returnUrl: payload.return_url,
      bizContent: {
        out_trade_no: payload.order_no,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        total_amount: Number(payload.amount).toFixed(2),
        subject: payload.subject,
        body: payload.body || payload.subject
      }
    });

    params.sign = this.signParams(params);
    const url = `${config.gateway}?${new URLSearchParams(params).toString()}`;
    console.log('[alipay] build page pay url done', {
      orderNo: payload.order_no,
      urlLength: url.length,
      hasNotifyUrl: Boolean(params.notify_url),
      hasReturnUrl: Boolean(params.return_url)
    });
    return url;
  }

  static async execute(method, bizContent, options = {}) {
    const config = this.assertEnabled();
    console.log('[alipay] execute start', {
      method,
      bizContent,
      options: {
        notifyUrl: options.notifyUrl || '',
        returnUrl: options.returnUrl || ''
      },
      config: this.getSafeConfigSnapshot()
    });
    const params = this.buildCommonParams({
      method,
      notifyUrl: options.notifyUrl,
      returnUrl: options.returnUrl,
      bizContent
    });
    params.sign = this.signParams(params);

    try {
      const response = await axios.post(
        config.gateway,
        new URLSearchParams(params).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
          },
          timeout: 15000
        }
      );

      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      const responseKey = `${method.replace(/\./g, '_')}_response`;
      const result = data?.[responseKey] || null;
      console.log('[alipay] execute done', {
        method,
        httpStatus: response.status,
        responseKey,
        code: result?.code || null,
        msg: result?.msg || null,
        subCode: result?.sub_code || null,
        subMsg: result?.sub_msg || null,
        tradeStatus: result?.trade_status || null
      });
      return result;
    } catch (error) {
      console.error('[alipay] execute failed', {
        method,
        message: error.message,
        code: error.code || null,
        status: error.response?.status || null,
        data: error.response?.data || null
      });
      throw error;
    }
  }
}

module.exports = AlipaySandboxService;
