// utils/image.js - 图片压缩与上传工具

/**
 * 选择图片（拍照或从相册）
 * @param {number} count - 选择数量上限
 * @returns {Promise<string[]>} 返回临时文件路径数组
 */
function chooseImage(count = 1) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFiles = res.tempFiles.map(f => f.tempFilePath);
        resolve(tempFiles);
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

/**
 * 压缩图片到指定尺寸（400×600）
 * 使用 wx.compressImage 直接压缩
 * @param {string} src - 图片临时路径
 * @returns {Promise<string>} 压缩后的图片路径
 */
function compressImage(src) {
  return new Promise((resolve, reject) => {
    // 先用 compressImage 压缩到目标尺寸
    wx.compressImage({
      src: src,
      quality: 80,
      compressedWidth: 400,
      compressedHeight: 600,
      success: (res) => {
        resolve(res.tempFilePath);
      },
      fail: (err) => {
        console.error('图片压缩失败，使用原图:', err);
        // 压缩失败就降级使用原图
        resolve(src);
      }
    });
  });
}

/**
 * 批量压缩图片
 * @param {string[]} paths - 图片路径数组
 * @returns {Promise<string[]>}
 */
async function compressImages(paths) {
  const results = [];
  for (const path of paths) {
    const compressed = await compressImage(path);
    results.push(compressed);
  }
  return results;
}

/**
 * 上传图片到云存储
 * @param {string} filePath - 本地文件路径
 * @param {string} folder - 云存储文件夹名
 * @returns {Promise<Object>} 返回 { fileID, cloudPath }
 */
function uploadImage(filePath, folder = 'reports') {
  return new Promise((resolve, reject) => {
    const cloudPath = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: (res) => {
        resolve({
          fileID: res.fileID,
          cloudPath: cloudPath
        });
      },
      fail: (err) => {
        console.error('图片上传失败:', err);
        reject(err);
      }
    });
  });
}

/**
 * 批量上传图片到云存储
 * @param {string[]} paths - 本地文件路径数组
 * @param {string} folder - 云存储文件夹名
 * @returns {Promise<Object[]>}
 */
async function uploadImages(paths, folder = 'reports') {
  const results = [];
  for (const path of paths) {
    const result = await uploadImage(path, folder);
    results.push(result);
  }
  return results;
}

/**
 * 获取图片临时链接
 * @param {string} fileID - 云存储文件ID
 * @returns {Promise<string>}
 */
function getTempFileURL(fileID) {
  return new Promise((resolve, reject) => {
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (res) => {
        if (res.fileList && res.fileList.length > 0) {
          resolve(res.fileList[0].tempFileURL);
        } else {
          reject(new Error('获取图片链接失败'));
        }
      },
      fail: reject
    });
  });
}

/**
 * 批量获取图片可访问链接
 * @param {string[]} fileIDs - 云存储fileID或https链接数组
 * @returns {Promise<string[]>}
 */
async function getTempFileURLs(fileIDs) {
  if (!fileIDs || fileIDs.length === 0) return [];

  // 统一转成字符串，过滤空值，并兼容对象格式
  const normalized = fileIDs
    .map(f => {
      if (typeof f === 'string') return f.trim();
      if (f && typeof f === 'object') return (f.fileID || f.url || f.cloudPath || '').trim();
      return '';
    })
    .filter(f => f.length > 0);

  if (normalized.length === 0) return [];

  // 把 cloud:// 开头的转成 https:// 临时链接；https:// 的直接保留
  const cloudFiles = normalized.filter(f => f.startsWith('cloud://'));
  const httpsFiles = normalized.filter(f => f.startsWith('http://') || f.startsWith('https://'));
  const otherFiles = normalized.filter(f => !f.startsWith('cloud://') && !f.startsWith('http://') && !f.startsWith('https://'));

  // 不认识的格式直接丢弃（避免影响正常图片）
  if (otherFiles.length > 0) {
    console.warn('getTempFileURLs: 发现非标准图片地址', otherFiles);
  }

  let cloudUrls = [];
  if (cloudFiles.length > 0) {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.cloud.getTempFileURL({
          fileList: cloudFiles,
          success: resolve,
          fail: reject
        });
      });
      cloudUrls = res.fileList.map(f => f.tempFileURL || f.fileID);
    } catch (err) {
      console.error('getTempFileURL 转换失败:', err);
      // 转换失败时，把 cloud:// 原样返回，让 image 组件自己尝试
      cloudUrls = cloudFiles;
    }
  }

  // 按原始顺序拼接结果
  const result = [];
  let cloudIdx = 0;
  let httpsIdx = 0;
  for (const f of normalized) {
    if (f.startsWith('cloud://')) {
      result.push(cloudUrls[cloudIdx++] || f);
    } else if (f.startsWith('http://') || f.startsWith('https://')) {
      result.push(httpsFiles[httpsIdx++]);
    }
  }
  return result;
}

/**
 * 完整的图片处理流程：选择 → 压缩 → 上传
 * @param {number} count - 选择数量
 * @returns {Promise<Object[]>} 返回上传结果数组
 */
async function processImages(count = 1) {
  // 1. 选择图片
  const tempPaths = await chooseImage(count);
  
  // 2. 压缩图片
  const compressedPaths = await compressImages(tempPaths);
  
  // 3. 上传到云存储
  const uploadResults = await uploadImages(compressedPaths);
  
  return uploadResults;
}

module.exports = {
  chooseImage,
  compressImage,
  compressImages,
  uploadImage,
  uploadImages,
  getTempFileURL,
  getTempFileURLs,
  processImages,
};
