// cloudfunctions/login/index.js - 微信用户登录
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { code } = event;
  const wxContext = cloud.getWXContext();

  try {
    let openid = wxContext.OPENID;

    // 如果context中没有openid，通过code获取
    if (!openid && code) {
      const result = await cloud.openapi.auth.code2Session({
        js_code: code
      });
      openid = result.openid;
    }

    if (!openid) {
      return { success: false, message: '获取用户信息失败' };
    }

    // 查找或创建用户记录
    const userRes = await db.collection('users').where({ openid }).get();
    
    if (userRes.data.length === 0) {
      // 新用户，创建记录
      await db.collection('users').add({
        data: {
          openid: openid,
          userType: 'normal',
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
        }
      });
    } else {
      // 更新登录时间
      await db.collection('users').doc(userRes.data[0]._id).update({
        data: {
          updateTime: db.serverDate(),
        }
      });
    }

    return {
      success: true,
      openid: openid,
    };
  } catch (err) {
    console.error('登录失败:', err);
    return {
      success: false,
      message: '登录失败: ' + err.message,
    };
  }
};
