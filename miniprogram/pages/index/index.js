// pages/index/index.js - 首页
const app = getApp();
const auth = require('../../utils/auth');

Page({
  data: {
    isLoggedIn: false,
    userType: '',
    loading: false,
  },

  onShow() {
    this.updateLoginStatus();
  },

  // 更新登录状态
  updateLoginStatus() {
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userType: app.globalData.userType,
    });
  },

  // 微信用户登录
  async handleWxLogin() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      // 先调用云函数获取 openid（不依赖 getUserProfile）
      const result = await auth.wxLogin();
      
      if (!result.success) {
        wx.showToast({ title: result.message || '登录失败', icon: 'none' });
        this.setData({ loading: false });
        return;
      }

      // 尝试获取用户信息（新版微信可能返回默认头像昵称，不影响登录）
      try {
        const { userInfo } = await wx.getUserProfile({ desc: '用于完善用户信息' });
        app.globalData.userInfo = userInfo;
        wx.setStorageSync('userInfo', userInfo);
      } catch (profileErr) {
        // 用户取消授权或 getUseProfile 不可用，不影响登录核心流程
        console.log('[登录] 获取用户信息跳过:', profileErr.errMsg || profileErr.message);
      }
      
      wx.showToast({ title: '登录成功', icon: 'success' });
      this.updateLoginStatus();
    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    }
    
    this.setData({ loading: false });
  },

  // 跳转到管理员登录
  goToAdminLogin() {
    wx.navigateTo({
      url: '/pages/admin-login/admin-login'
    });
  },

  // 跳转到隐患上报
  goToReport() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/report/report'
    });
  },

  // 跳转到我的记录
  goToMyReports() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/my-reports/my-reports'
    });
  },

  // 跳转到管理后台
  goToAdminDashboard() {
    wx.navigateTo({
      url: '/pages/admin-dashboard/admin-dashboard'
    });
  },

  // 跳转到修改密码
  goToChangePassword() {
    wx.navigateTo({
      url: '/pages/change-password/change-password'
    });
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          auth.logout();
          this.updateLoginStatus();
          wx.showToast({ title: '已退出登录', icon: 'none' });
        }
      }
    });
  },
});
