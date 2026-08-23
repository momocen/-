// pages/my-reports/my-reports.js - 我的隐患记录
const request = require('../../utils/request');
const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    reports: [],
    loading: false,
    loadingMore: false,
    hasMore: true,
    totalCount: 0,
    monthCount: 0,
    page: 1,
    pageSize: 20,
    debugInfo: '', // 调试信息
  },

  onShow() {
    const loggedIn = app.globalData.isLoggedIn;
    const openid = app.globalData.openid;
    
    // 调试：打印关键状态
    console.log('[我的记录] onShow - isLoggedIn:', loggedIn, 'openid:', openid ? openid.substring(0, 10) + '...' : 'null');
    
    this.setData({ 
      isLoggedIn: loggedIn,
      debugInfo: '登录状态: ' + (loggedIn ? '已登录 (openid:' + (openid ? openid.substring(0,8)+'...' : '无') + ')' : '未登录')
    });

    if (loggedIn) {
      this.setData({ reports: [], hasMore: true, page: 1 });
      this.loadReports();
    }
  },

  onPullDownRefresh() {
    this.setData({ reports: [], hasMore: true, page: 1 });
    this.loadReports().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  // 加载报告列表
  async loadReports() {
    if (this.data.loading) return;
    
    this.setData({ loading: true, debugInfo: '正在查询数据...' });

    try {
      // 普通用户不传 openid，云函数会自动用调用者身份过滤
      console.log('[我的记录] 调用 getReports 云函数...');
      const result = await request.getReports({
        page: 1,
        pageSize: this.data.pageSize,
      });

      console.log('[我的记录] 云函数返回:', JSON.stringify({
        success: result.success,
        total: result.total,
        dataLength: result.data ? result.data.length : 0,
        monthCount: result.monthCount,
        todayCount: result.todayCount,
      }));

      if (result.data && result.data.length > 0) {
        // 格式化时间
        const reports = result.data.map(r => ({
          ...r,
          createTimeText: this.formatTime(r.createTime),
          updateTimeText: this.formatTime(r.updateTime),
        }));

        this.setData({
          reports: reports,
          totalCount: result.total || reports.length,
          monthCount: result.monthCount || this.calcMonthCount(reports),
          hasMore: reports.length >= this.data.pageSize,
          loading: false,
          debugInfo: '查询成功，共 ' + (result.total || reports.length) + ' 条记录',
        });
      } else {
        // 数据为空
        this.setData({
          reports: [],
          totalCount: 0,
          monthCount: 0,
          hasMore: false,
          loading: false,
          debugInfo: '查询成功，但没有数据。请确认：(1)已提交过隐患 (2)submitReport云函数已上传 (3)reports数据库集合存在',
        });
        console.warn('[我的记录] 查询返回空数据，total:', result.total, 'data:', result.data);
      }
    } catch (err) {
      console.error('[我的记录] 查询失败:', err);
      this.setData({ 
        loading: false,
        debugInfo: '查询失败: ' + (err.message || '未知错误') + '。请检查getReports云函数是否已上传。',
      });
    }
  },

  // 加载更多
  async loadMore() {
    this.setData({ loadingMore: true });
    const nextPage = this.data.page + 1;

    try {
      const result = await request.getReports({
        page: nextPage,
        pageSize: this.data.pageSize,
      });

      if (result.data && result.data.length > 0) {
        const reports = result.data.map(r => ({
          ...r,
          createTimeText: this.formatTime(r.createTime),
          updateTimeText: this.formatTime(r.updateTime),
        }));

        this.setData({
          reports: [...this.data.reports, ...reports],
          page: nextPage,
          hasMore: reports.length >= this.data.pageSize,
        });
      } else {
        this.setData({ hasMore: false });
      }
    } catch (err) {
      console.error('[我的记录] 加载更多失败:', err);
    }

    this.setData({ loadingMore: false });
  },

  // 点击记录卡片
  onReportTap(e) {
    const { report } = e.detail;
    wx.navigateTo({
      url: `/pages/report-detail/report-detail?id=${report._id}`
    });
  },

  // 编辑记录
  onReportEdit(e) {
    const { report } = e.detail;
    wx.navigateTo({
      url: `/pages/report/report?id=${report._id}&mode=edit`
    });
  },

  // 删除记录
  onReportDelete(e) {
    const { report } = e.detail;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条隐患记录吗？删除后不可恢复。',
      confirmColor: '#E74C3C',
      success: async (res) => {
        if (res.confirm) {
          try {
            await request.deleteReport(report._id);
            wx.showToast({ title: '删除成功', icon: 'success' });
            
            // 刷新列表
            this.setData({ reports: [], hasMore: true, page: 1 });
            this.loadReports();
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 跳转到登录 — 改为 navigateTo（tabBar已移除）
  goToLogin() {
    wx.redirectTo({ url: '/pages/index/index' });
  },

  // 跳转到上报 — 改为 navigateTo（tabBar已移除）
  goToReport() {
    wx.navigateTo({ url: '/pages/report/report' });
  },

  // 格式化时间
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

  // 计算本月数量
  calcMonthCount(reports) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return reports.filter(r => {
      const t = r.createTime;
      return t && new Date(t).getTime() >= monthStart;
    }).length;
  },
});
