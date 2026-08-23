// pages/admin-edit/admin-edit.js - 管理员编辑记录（与report.js类似，直接使用updateReport）
const request = require('../../utils/request');
const app = getApp();

Page({
  data: {
    editId: null,
    submitting: false,
    formData: {
      department1: '', department2: '', location: '',
      hazardPhotos: [], hazardDescription: '',
      causeAnalysis: '', suggestedMeasures: '',
      acceptancePhotos: [], acceptor: '',
      acceptanceTime: '', reporter: '', reporterId: '',
    }
  },

  onLoad(options) {
    if (!app.globalData.isLoggedIn || app.globalData.userType !== 'admin') {
      wx.showModal({
        title: '提示', content: '请使用管理员账号登录', showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }
    if (options.id) {
      this.setData({ editId: options.id });
      this.loadReportData(options.id);
    }
  },

  async loadReportData(id) {
    try {
      const result = await request.callCloud('getReports', { id });
      if (result && result.data && result.data.length > 0) {
        const report = result.data[0];
        this.setData({
          formData: {
            department1: report.department1 || '',
            department2: report.department2 || '',
            location: report.location || '',
            hazardPhotos: report.hazardPhotos || [],
            hazardDescription: report.hazardDescription || '',
            causeAnalysis: report.causeAnalysis || '',
            suggestedMeasures: report.suggestedMeasures || '',
            acceptancePhotos: report.acceptancePhotos || [],
            acceptor: report.acceptor || '',
            acceptanceTime: report.acceptanceTime || '',
            reporter: report.reporter || '',
            reporterId: report.reporterId || '',
          }
        });
        setTimeout(() => this.updateImageUploaders(), 300);
      }
    } catch (err) {
      wx.showToast({ title: '加载数据失败', icon: 'none' });
    }
  },

  updateImageUploaders() {
    const h = this.selectComponent('#hazardPhotoUploader');
    const a = this.selectComponent('#acceptancePhotoUploader');
    if (h) h.setImages(this.data.formData.hazardPhotos);
    if (a) a.setImages(this.data.formData.acceptancePhotos);
  },

  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  onAcceptanceTimeChange(e) {
    this.setData({ 'formData.acceptanceTime': e.detail.value });
  },

  onHazardPhotosChange(e) {
    this.setData({ 'formData.hazardPhotos': e.detail.fileIDs });
  },

  onAcceptancePhotosChange(e) {
    this.setData({ 'formData.acceptancePhotos': e.detail.fileIDs });
  },

  validateForm() {
    const { formData } = this.data;
    const requiredFields = [
      { field: 'location', name: '地点' },
      { field: 'hazardDescription', name: '隐患说明' },
      { field: 'acceptor', name: '验收人' },
      { field: 'acceptanceTime', name: '验收时间' },
      { field: 'reporter', name: '报告人' },
      { field: 'reporterId', name: '报告人工号' },
    ];
    for (const item of requiredFields) {
      if (!formData[item.field] || !formData[item.field].trim()) {
        wx.showToast({ title: `请填写${item.name}`, icon: 'none' });
        return false;
      }
    }
    const h = this.selectComponent('#hazardPhotoUploader');
    const a = this.selectComponent('#acceptancePhotoUploader');
    if ((!h || h.getFileIDs().length === 0) && formData.hazardPhotos.length === 0) {
      wx.showToast({ title: '请上传隐患照片', icon: 'none' }); return false;
    }
    if ((!a || a.getFileIDs().length === 0) && formData.acceptancePhotos.length === 0) {
      wx.showToast({ title: '请上传验收照片', icon: 'none' }); return false;
    }
    return true;
  },

  async handleSubmit() {
    if (this.data.submitting) return;
    if (!this.validateForm()) return;

    const confirmed = await new Promise(r => wx.showModal({
      title: '确认保存', content: '确定保存修改吗？', success: res => r(res.confirm)
    }));
    if (!confirmed) return;

    this.setData({ submitting: true });
    try {
      const h = this.selectComponent('#hazardPhotoUploader');
      const a = this.selectComponent('#acceptancePhotoUploader');
      const submitData = {
        ...this.data.formData,
        id: this.data.editId,
        hazardPhotos: h ? h.getFileIDs() : this.data.formData.hazardPhotos,
        acceptancePhotos: a ? a.getFileIDs() : this.data.formData.acceptancePhotos,
      };
      await request.updateReport(submitData);
      wx.showToast({ title: '修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
    this.setData({ submitting: false });
  },
});
