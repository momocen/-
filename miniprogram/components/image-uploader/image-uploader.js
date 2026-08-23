// components/image-uploader/image-uploader.js - 图片上传组件
const imageUtil = require('../../utils/image');

Component({
  properties: {
    // 标签文字
    label: {
      type: String,
      value: '图片'
    },
    // 是否必填
    required: {
      type: Boolean,
      value: false
    },
    // 最大上传数量
    maxCount: {
      type: Number,
      value: 1
    },
    // 是否显示提示
    showHint: {
      type: Boolean,
      value: true
    },
    // 初始图片列表（编辑时用）
    value: {
      type: Array,
      value: []
    }
  },

  data: {
    images: [],       // 显示的图片URL列表
    fileIDs: [],      // 云存储文件ID列表
    uploading: false,
  },

  lifetimes: {
    attached() {
      // 如果有初始值，设置图片
      if (this.properties.value && this.properties.value.length > 0) {
        this.setData({
          images: [...this.properties.value],
          fileIDs: [...this.properties.value]
        });
      }
    }
  },

  observers: {
    'value'(newVal) {
      if (newVal && newVal.length > 0 && this.data.images.length === 0) {
        this.setData({
          images: [...newVal],
          fileIDs: [...newVal]
        });
      }
    }
  },

  methods: {
    // 添加图片
    async handleAddImage() {
      const { maxCount, images } = this.data;
      const remainCount = maxCount - images.length;
      
      if (remainCount <= 0) {
        wx.showToast({ title: `最多上传${maxCount}张图片`, icon: 'none' });
        return;
      }

      try {
        this.setData({ uploading: true });
        
        // 选择图片
        const tempPaths = await imageUtil.chooseImage(remainCount);
        
        // 压缩图片
        const compressedPaths = [];
        for (const path of tempPaths) {
          const compressed = await imageUtil.compressImage(path);
          compressedPaths.push(compressed);
        }
        
        // 上传到云存储
        const uploadResults = await imageUtil.uploadImages(compressedPaths);
        
        // 获取临时链接用于预览
        const newFileIDs = uploadResults.map(r => r.fileID);
        const newPreviewUrls = await imageUtil.getTempFileURLs(newFileIDs);
        
        // 更新数据
        const allImages = [...images, ...newPreviewUrls];
        const allFileIDs = [...this.data.fileIDs, ...newFileIDs];
        
        this.setData({
          images: allImages,
          fileIDs: allFileIDs,
          uploading: false
        });
        
        this.triggerChange();
        
      } catch (err) {
        this.setData({ uploading: false });
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '图片处理失败', icon: 'none' });
        }
      }
    },

    // 删除图片
    deleteImage(e) {
      const { index } = e.currentTarget.dataset;
      const images = [...this.data.images];
      const fileIDs = [...this.data.fileIDs];
      
      images.splice(index, 1);
      fileIDs.splice(index, 1);
      
      this.setData({ images, fileIDs });
      this.triggerChange();
    },

    // 预览图片
    previewImage(e) {
      const { index } = e.currentTarget.dataset;
      wx.previewImage({
        current: this.data.images[index],
        urls: this.data.images
      });
    },

    // 触发变更事件
    triggerChange() {
      this.triggerEvent('change', {
        images: this.data.images,
        fileIDs: this.data.fileIDs
      });
    },

    // 获取文件ID列表（供外部调用）
    getFileIDs() {
      return this.data.fileIDs;
    },

    // 获取图片URL列表
    getImageUrls() {
      return this.data.images;
    },

    // 设置图片（编辑模式）
    async setImages(fileIDs) {
      if (!fileIDs || fileIDs.length === 0) {
        this.setData({ images: [], fileIDs: [] });
        return;
      }
      
      const urls = await imageUtil.getTempFileURLs(fileIDs);
      this.setData({
        images: urls,
        fileIDs: fileIDs
      });
      this.triggerChange();
    }
  }
});
