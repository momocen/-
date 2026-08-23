// pages/report-detail/report-detail.js - 隐患详情
const request = require('../../utils/request');
const imageUtil = require('../../utils/image');

Page({
  data: {
    loading: true,
    report: null,
    hazardImageUrls: [],
    acceptanceImageUrls: [],
  },

  onLoad(options) {
    if (options.id) {
      this.loadDetail(options.id);
    }
  },

  async loadDetail(id) {
    try {
      const result = await request.callCloud('getReports', { id });
      
      if (result && result.data && result.data.length > 0) {
        const report = result.data[0];
        
        // 格式化时间
        report.createTimeText = this.formatTime(report.createTime);
        report.updateTimeText = this.formatTime(report.updateTime);
        
        this.setData({ report, loading: false });
        
        // 加载图片
        this.loadImages(report);
      } else {
        this.setData({ report: null, loading: false });
      }
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadImages(report) {
    const normalize = (photos) => {
      if (!photos || photos.length === 0) return [];
      return photos.map(p => {
        if (typeof p === 'string') return p.trim();
        if (p && typeof p === 'object') return (p.fileID || p.url || '').trim();
        return '';
      }).filter(p => p);
    };

    const hazardPhotos = normalize(report.hazardPhotos);
    const acceptancePhotos = normalize(report.acceptancePhotos);

    console.log('report-detail 图片字段:', { hazardPhotos, acceptancePhotos });

    // 加载隐患照片
    if (hazardPhotos.length > 0) {
      try {
        const urls = await imageUtil.getTempFileURLs(hazardPhotos);
        console.log('report-detail 隐患照片URL:', urls);
        this.setData({ hazardImageUrls: urls });
      } catch (err) {
        console.error('加载隐患照片失败:', err);
      }
    }

    // 加载验收照片
    if (acceptancePhotos.length > 0) {
      try {
        const urls = await imageUtil.getTempFileURLs(acceptancePhotos);
        console.log('report-detail 验收照片URL:', urls);
        this.setData({ acceptanceImageUrls: urls });
      } catch (err) {
        console.error('加载验收照片失败:', err);
      }
    }
  },

  previewImage(e) {
    const { index, type } = e.currentTarget.dataset;
    const urls = (type === 'acceptance' ? this.data.acceptanceImageUrls : this.data.hazardImageUrls)
      .filter(u => u && (u.startsWith('http') || u.startsWith('cloud://')));
    if (!urls || urls.length === 0) {
      wx.showToast({ title: '无有效图片', icon: 'none' });
      return;
    }
    const current = urls[index] || urls[0];
    wx.previewImage({ urls, current });
  },

  onImageError(e) {
    const url = e.currentTarget.dataset.src || e.currentTarget.dataset.url || '';
    console.error('report-detail 图片加载失败:', url);
  },

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },
});
