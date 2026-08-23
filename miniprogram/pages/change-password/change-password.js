// pages/change-password/change-password.js - 修改管理员密码
const request = require('../../utils/request');
const app = getApp();

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    showOld: false,
    showNew: false,
    showConfirm: false,
    loading: false,
  },

  onLoad() {
    if (!app.globalData.isLoggedIn || app.globalData.userType !== 'admin') {
      wx.showModal({
        title: '提示', content: '请使用管理员账号登录', showCancel: false,
        success: () => wx.navigateBack()
      });
    }
  },

  onOldPasswordInput(e) { this.setData({ oldPassword: e.detail.value }); },
  onNewPasswordInput(e) { this.setData({ newPassword: e.detail.value }); },
  onConfirmPasswordInput(e) { this.setData({ confirmPassword: e.detail.value }); },
  toggleOld() { this.setData({ showOld: !this.data.showOld }); },
  toggleNew() { this.setData({ showNew: !this.data.showNew }); },
  toggleConfirm() { this.setData({ showConfirm: !this.data.showConfirm }); },

  validateForm() {
    const { oldPassword, newPassword, confirmPassword } = this.data;
    if (!oldPassword) { wx.showToast({ title: '请输入当前密码', icon: 'none' }); return false; }
    if (!newPassword) { wx.showToast({ title: '请输入新密码', icon: 'none' }); return false; }
    if (newPassword.length < 6) { wx.showToast({ title: '新密码至少6位', icon: 'none' }); return false; }
    if (newPassword !== confirmPassword) { wx.showToast({ title: '两次输入的新密码不一致', icon: 'none' }); return false; }
    if (oldPassword === newPassword) { wx.showToast({ title: '新密码不能与当前密码相同', icon: 'none' }); return false; }
    return true;
  },

  async handleSubmit() {
    if (this.data.loading) return;
    if (!this.validateForm()) return;

    const confirmed = await new Promise(r => wx.showModal({
      title: '确认修改', content: '确定修改密码吗？修改后需要重新登录。',
      success: res => r(res.confirm)
    }));
    if (!confirmed) return;

    this.setData({ loading: true });
    try {
      const adminUser = app.globalData.adminUser;
      await request.changePassword({
        username: adminUser?.username || 'Lier',
        oldPassword: this.data.oldPassword,
        newPassword: this.data.newPassword,
      });
      wx.showToast({ title: '密码修改成功', icon: 'success' });
      setTimeout(() => {
        app.logout();
        wx.showModal({
          title: '提示', content: '密码已修改，请使用新密码重新登录。',
          showCancel: false,
          success: () => {
            wx.reLaunch({ url: '/pages/index/index' });
          }
        });
      }, 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '修改失败', icon: 'none' });
    }
    this.setData({ loading: false });
  },
});
