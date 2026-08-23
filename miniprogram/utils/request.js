// utils/request.js - 云函数调用封装

/**
 * 调用云函数（统一封装）
 */
async function callCloud(name, data = {}) {
  try {
    wx.showLoading({ title: '加载中...', mask: true });
    const res = await wx.cloud.callFunction({ name, data });
    wx.hideLoading();
    
    if (res.result && res.result.success === false) {
      wx.showToast({ title: res.result.message || '操作失败', icon: 'none' });
      throw new Error(res.result.message);
    }
    
    return res.result;
  } catch (err) {
    wx.hideLoading();
    wx.showToast({ title: err.message || '网络错误，请重试', icon: 'none' });
    throw err;
  }
}

/**
 * 获取隐患报告列表
 * @param {Object} params - 查询参数
 * @param {string} params.openid - 用户openid（可选，不传则查全部用于管理员）
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 */
async function getReports(params = {}) {
  return callCloud('getReports', params);
}

/**
 * 提交隐患报告
 */
async function submitReport(data) {
  return callCloud('submitReport', data);
}

/**
 * 更新隐患报告
 */
async function updateReport(data) {
  return callCloud('updateReport', data);
}

/**
 * 删除隐患报告（支持单条和批量）
 * @param {string|string[]} ids - 单个ID或ID数组
 */
async function deleteReport(ids) {
  // 兼容单条删除（传入字符串）和批量删除（传入数组）
  const idArray = Array.isArray(ids) ? ids : [ids];
  return callCloud('deleteReport', { ids: idArray });
}

/**
 * 修改管理员密码
 */
async function changePassword(data) {
  return callCloud('changePassword', data);
}

/**
 * 导出Excel
 */
async function exportExcel(ids) {
  return callCloud('exportExcel', { ids });
}

module.exports = {
  callCloud,
  getReports,
  submitReport,
  updateReport,
  deleteReport,
  changePassword,
  exportExcel,
};
