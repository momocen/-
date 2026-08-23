// pages/admin-login/admin-login.js - 管理员登录
const auth = require('../../utils/auth');
const app = getApp();

Page({
  data: {
    username: '',
    password: '',
    showPassword: false,
    loading: false,
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  async handleLogin() {
    const { username, password, loading } = this.data;
    
    if (loading) return;
    
    // 表单验证
    if (!username.trim()) {
      wx.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    if (!password.trim()) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await auth.adminLogin(username.trim(), password.trim());
      
      if (result.success) {
        wx.showToast({ title: '登录成功', icon: 'success' });
        // 如果是首次登录，提示修改密码
        if (result.isFirstLogin) {
          setTimeout(() => {
            wx.showModal({
              title: '安全提示',
              content: '检测到您使用的是初始密码，建议立即修改密码以确保安全。',
              confirmText: '去修改',
              cancelText: '稍后',
              success: (res) => {
                if (res.confirm) {
                  wx.redirectTo({
                    url: '/pages/change-password/change-password'
                  });
                } else {
                  wx.navigateBack();
                }
              }
            });
          }, 1500);
        } else {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      } else {
        wx.showToast({ title: result.message || '登录失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: err.message || '登录失败，请重试', icon: 'none' });
    }

    this.setData({ loading: false });
  },

  goBack() {
    wx.navigateBack();
  },
});
