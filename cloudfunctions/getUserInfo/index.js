// cloudfunctions/getUserInfo/index.js - 获取用户信息
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    const result = await db.collection('users').where({ openid }).get();
    
    if (result.data.length > 0) {
      return {
        success: true,
        user: result.data[0],
      };
    }
    
    return {
      success: true,
      user: null,
    };
  } catch (err) {
    return {
      success: false,
      message: '获取用户信息失败',
    };
  }
};
