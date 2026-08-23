// app.js - 员工安全隐患排查上报系统
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d8gw0cwhj6ec369ce', // 替换为你的云开发环境ID
        traceUser: true,
      });
    }

    // 检查登录状态
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const userType = wx.getStorageSync('userType');
    const openid = wx.getStorageSync('openid');

    // 恢复 openid（之前遗漏了，导致重启后查不到数据）
    if (openid) {
      this.globalData.openid = openid;
    }

    // 只要有 openid 或 userType 之一就认为已登录
    if (userType || openid) {
      this.globalData.userType = userType || 'normal';
      this.globalData.isLoggedIn = true;
    }

    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
  },

  // 微信用户登录
  async wxLogin() {
    try {
      const { code } = await wx.login();
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: { code }
      });
      const { openid } = res.result;
      
      this.globalData.openid = openid;
      this.globalData.userType = 'normal';
      this.globalData.isLoggedIn = true;
      
      wx.setStorageSync('openid', openid);
      wx.setStorageSync('userType', 'normal');
      
      return openid;
    } catch (err) {
      console.error('微信登录失败:', err);
      throw err;
    }
  },

  // 管理员登录
  async adminLogin(username, password) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminLogin',
        data: { username, password }
      });
      
      if (res.result.success) {
        this.globalData.userType = 'admin';
        this.globalData.isLoggedIn = true;
        this.globalData.adminUser = res.result.adminUser;
        
        wx.setStorageSync('userType', 'admin');
        wx.setStorageSync('adminToken', res.result.token);
        
        return res.result;
      } else {
        throw new Error(res.result.message || '登录失败');
      }
    } catch (err) {
      throw err;
    }
  },

  // 退出登录
  logout() {
    this.globalData.openid = null;
    this.globalData.userInfo = null;
    this.globalData.userType = null;
    this.globalData.isLoggedIn = false;
    this.globalData.adminUser = null;
    
    wx.removeStorageSync('openid');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('userType');
    wx.removeStorageSync('adminToken');
  },

  globalData: {
    openid: null,
    userInfo: null,
    userType: null,      // 'normal' | 'admin'
    isLoggedIn: false,
    adminUser: null,
  }
});
