// components/report-card/report-card.js - 隐患记录卡片组件
const imageUtil = require('../../utils/image');

Component({
  properties: {
    report: {
      type: Object,
      value: {}
    },
    showActions: {
      type: Boolean,
      value: false
    },
    showCheckbox: {
      type: Boolean,
      value: false
    }
  },

  data: {
    previewImages: [],
    imageErrors: []   // 记录每张图片是否加载失败
  },

  lifetimes: {
    attached() {
      this.loadPreviewImages();
    }
  },

  observers: {
    'report'(newVal) {
      if (newVal && newVal._id) {
        this.loadPreviewImages();
      }
    }
  },

  methods: {
    // 加载预览图片
    async loadPreviewImages() {
      const { report } = this.properties;
      if (!report || !report._id) return;

      // 同时收集隐患照片和验收照片，全部显示
      const imageIDs = [];
      const pushPhotos = (photos) => {
        if (!photos || photos.length === 0) return;
        photos.forEach(p => {
          if (typeof p === 'string' && p.trim()) imageIDs.push(p.trim());
          else if (p && typeof p === 'object' && (p.fileID || p.url)) imageIDs.push(p.fileID || p.url);
        });
      };

      pushPhotos(report.hazardPhotos);
      pushPhotos(report.acceptancePhotos);

      console.log('report-card 加载图片:', report._id, '原始字段:', report.hazardPhotos, report.acceptancePhotos);

      if (imageIDs.length === 0) {
        this.setData({ previewImages: [] });
        return;
      }

      try {
        const urls = await imageUtil.getTempFileURLs(imageIDs);
        console.log('report-card 图片链接:', urls);
        this.setData({ previewImages: urls });
      } catch (err) {
        console.error('加载预览图片失败:', err);
        this.setData({ previewImages: [] });
      }
    },

    // 点击卡片
    handleTap() {
      this.triggerEvent('tap', { report: this.properties.report });
    },

    // 编辑
    handleEdit() {
      this.triggerEvent('edit', { report: this.properties.report });
    },

    // 删除
    handleDelete() {
      this.triggerEvent('delete', { report: this.properties.report });
    },

    // 勾选
    handleCheck() {
      this.triggerEvent('check', { 
        report: this.properties.report,
        checked: !this.properties.report.checked
      });
    },

    // 预览图片（直接从data取，避免WXML data-*数组序列化问题）
    previewImage(e) {
      const index = e.currentTarget.dataset.index;
      const urls = this.data.previewImages.filter(u => u && (u.startsWith('http') || u.startsWith('cloud://')));
      if (!urls || urls.length === 0) {
        wx.showToast({ title: '无有效图片', icon: 'none' });
        return;
      }
      const current = urls[index] || urls[0];
      wx.previewImage({ urls, current });
    },

    // 图片加载成功
    onImageLoad(e) {
      const index = e.currentTarget.dataset.index;
      const imageErrors = [...this.data.imageErrors];
      imageErrors[index] = false;
      this.setData({ imageErrors });
    },

    // 图片加载失败
    onImageError(e) {
      const index = e.currentTarget.dataset.index;
      const url = e.currentTarget.dataset.url;
      console.error('report-card 图片加载失败:', index, url);
      const imageErrors = [...this.data.imageErrors];
      imageErrors[index] = true;
      this.setData({ imageErrors });
    }
  }
});
