// utils/auth.js - 认证管理工具
const app = getApp();

/**
 * 检查是否已登录
 */
function isLoggedIn() {
  return app.globalData.isLoggedIn;
}

/**
 * 获取当前用户类型
 */
function getUserType() {
  return app.globalData.userType;
}

/**
 * 检查是否为管理员
 */
function isAdmin() {
  return app.globalData.userType === 'admin';
}

/**
 * 微信用户登录
 */
async function wxLogin() {
  try {
    const openid = await app.wxLogin();
    return { success: true, openid };
  } catch (err) {
    return { success: false, message: err.message || '登录失败' };
  }
}

/**
 * 管理员登录
 */
async function adminLogin(username, password) {
  try {
    const result = await app.adminLogin(username, password);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, message: err.message || '登录失败' };
  }
}

/**
 * 退出登录
 */
function logout() {
  app.logout();
}

/**
 * 获取用户openid
 */
function getOpenId() {
  if (app.globalData.userType === 'admin') {
    return 'admin_' + app.globalData.adminUser?.username;
  }
  return app.globalData.openid;
}

module.exports = {
  isLoggedIn,
  getUserType,
  isAdmin,
  wxLogin,
  adminLogin,
  logout,
  getOpenId,
};
