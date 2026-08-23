// pages/report/report.js - 隐患上报表单
const request = require('../../utils/request');
const app = getApp();

Page({
  data: {
    isEdit: false,      // 是否为编辑模式
    editId: null,       // 编辑的记录ID
    submitting: false,
    formData: {
      department1: '',
      department2: '',
      location: '',
      hazardPhotos: [],      // 云存储文件ID数组
      hazardDescription: '',
      causeAnalysis: '',
      suggestedMeasures: '',
      acceptancePhotos: [],  // 云存储文件ID数组
      acceptor: '',
      acceptanceTime: '',
      reporter: '',
      reporterId: '',
    }
  },

  onLoad(options) {
    // 检查登录状态
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再上报隐患',
        showCancel: false,
        success: () => {
          wx.redirectTo({ url: '/pages/index/index' });
        }
      });
      return;
    }

    // 编辑模式
    if (options.id && options.mode === 'edit') {
      this.setData({ isEdit: true, editId: options.id });
      this.loadReportData(options.id);
    }
  },

  // 加载编辑数据
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
        
        // 触发图片组件更新
        this.updateImageUploaders();
      }
    } catch (err) {
      wx.showToast({ title: '加载数据失败', icon: 'none' });
    }
  },

  // 更新图片上传组件
  updateImageUploaders() {
    const hazardUploader = this.selectComponent('#hazardPhotoUploader');
    const acceptanceUploader = this.selectComponent('#acceptancePhotoUploader');
    
    if (hazardUploader) {
      hazardUploader.setImages(this.data.formData.hazardPhotos);
    }
    if (acceptanceUploader) {
      acceptanceUploader.setImages(this.data.formData.acceptancePhotos);
    }
  },

  // 表单字段变更
  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`formData.${field}`]: value
    });
  },

  // 验收时间选择
  onAcceptanceTimeChange(e) {
    this.setData({
      'formData.acceptanceTime': e.detail.value
    });
  },

  // 隐患照片变更
  onHazardPhotosChange(e) {
    const { fileIDs } = e.detail;
    this.setData({
      'formData.hazardPhotos': fileIDs
    });
  },

  // 验收照片变更
  onAcceptancePhotosChange(e) {
    const { fileIDs } = e.detail;
    this.setData({
      'formData.acceptancePhotos': fileIDs
    });
  },

  // 选择位置
  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        if (res.name) {
          const location = res.address 
            ? `${res.name}（${res.address}）` 
            : res.name;
          this.setData({
            'formData.location': location
          });
        }
      },
      fail: (err) => {
        if (!err.errMsg.includes('cancel')) {
          wx.showToast({ title: '获取位置失败', icon: 'none' });
        }
      }
    });
  },

  // 表单验证
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

    // 检查文本必填项
    for (const item of requiredFields) {
      if (!formData[item.field] || !formData[item.field].trim()) {
        wx.showToast({ title: `请填写${item.name}`, icon: 'none' });
        return false;
      }
    }

    // 检查隐患照片
    const hazardUploader = this.selectComponent('#hazardPhotoUploader');
    const hazardFileIDs = hazardUploader ? hazardUploader.getFileIDs() : formData.hazardPhotos;
    if (!hazardFileIDs || hazardFileIDs.length === 0) {
      wx.showToast({ title: '请上传隐患照片', icon: 'none' });
      return false;
    }

    // 检查验收照片
    const acceptanceUploader = this.selectComponent('#acceptancePhotoUploader');
    const acceptanceFileIDs = acceptanceUploader ? acceptanceUploader.getFileIDs() : formData.acceptancePhotos;
    if (!acceptanceFileIDs || acceptanceFileIDs.length === 0) {
      wx.showToast({ title: '请上传验收照片', icon: 'none' });
      return false;
    }

    return true;
  },

  // 提交表单
  async handleSubmit() {
    if (this.data.submitting) return;

    // 表单验证
    if (!this.validateForm()) return;

    // 确认提交
    const confirmText = this.data.isEdit ? '确定保存修改吗？' : '确定提交此隐患报告吗？';
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认提交',
        content: confirmText,
        success: (res) => resolve(res.confirm)
      });
    });

    if (!confirmed) return;

    this.setData({ submitting: true });

    try {
      // 获取最新的照片文件ID
      const hazardUploader = this.selectComponent('#hazardPhotoUploader');
      const acceptanceUploader = this.selectComponent('#acceptancePhotoUploader');
      
      const hazardPhotos = hazardUploader ? hazardUploader.getFileIDs() : this.data.formData.hazardPhotos;
      const acceptancePhotos = acceptanceUploader ? acceptanceUploader.getFileIDs() : this.data.formData.acceptancePhotos;

      const submitData = {
        ...this.data.formData,
        hazardPhotos: hazardPhotos,
        acceptancePhotos: acceptancePhotos,
      };

      let result;
      if (this.data.isEdit) {
        // 编辑模式
        submitData.id = this.data.editId;
        result = await request.updateReport(submitData);
      } else {
        // 新增模式
        result = await request.submitReport(submitData);
      }

      if (result.success) {
        wx.showToast({ 
          title: this.data.isEdit ? '修改成功' : '提交成功', 
          icon: 'success' 
        });
        
        // 延迟返回
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (err) {
      console.error('提交失败:', err);
      wx.showToast({ title: err.message || '提交失败，请重试', icon: 'none' });
    }

    this.setData({ submitting: false });
  },
});
