// pages/admin-dashboard/admin-dashboard.js - 管理后台
const request = require('../../utils/request');
const app = getApp();

Page({
  data: {
    isAdmin: false,
    reports: [],
    loading: false,
    loadingMore: false,
    hasMore: true,
    totalCount: 0,
    todayCount: 0,
    monthCount: 0,
    selectedCount: 0,
    allSelected: false,
    exporting: false,
    page: 1,
    pageSize: 50,
  },

  onShow() {
    const isAdmin = app.globalData.userType === 'admin' && app.globalData.isLoggedIn;
    this.setData({ isAdmin });
    
    if (isAdmin) {
      this.page = 1;
      this.setData({ 
        reports: [], 
        hasMore: true,
        allSelected: false,
        selectedCount: 0
      });
      this.loadReports();
    }
  },

  onPullDownRefresh() {
    this.page = 1;
    this.setData({ 
      reports: [], 
      hasMore: true,
      allSelected: false,
      selectedCount: 0
    });
    this.loadReports().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  // 加载报告列表（全部）
  async loadReports() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });

    try {
      const result = await request.getReports({
        isAdmin: true,
        page: 1,
        pageSize: this.data.pageSize,
      });

      if (result.data) {
        const reports = this.formatReports(result.data);
        
        this.setData({
          reports: reports,
          totalCount: result.total || reports.length,
          todayCount: result.todayCount || this.calcTodayCount(reports),
          monthCount: result.monthCount || this.calcMonthCount(reports),
          hasMore: reports.length >= this.data.pageSize,
          loading: false,
        });
      }
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  // 加载更多
  async loadMore() {
    this.setData({ loadingMore: true });

    try {
      const nextPage = this.data.page + 1;
      const result = await request.getReports({
        isAdmin: true,
        page: nextPage,
        pageSize: this.data.pageSize,
      });

      if (result.data && result.data.length > 0) {
        const newReports = this.formatReports(result.data);
        this.setData({
          reports: [...this.data.reports, ...newReports],
          page: nextPage,
          hasMore: newReports.length >= this.data.pageSize,
        });
      } else {
        this.setData({ hasMore: false });
      }
    } catch (err) {
      // 静默处理
    }

    this.setData({ loadingMore: false });
  },

  // 格式化报告数据
  formatReports(reports) {
    return reports.map(r => ({
      ...r,
      checked: false,
      createTimeText: this.formatTime(r.createTime),
      updateTimeText: this.formatTime(r.updateTime),
    }));
  },

  // 全选/取消全选
  toggleSelectAll() {
    const allSelected = !this.data.allSelected;
    const reports = this.data.reports.map(r => ({
      ...r,
      checked: allSelected
    }));
    
    this.setData({
      reports,
      allSelected,
      selectedCount: allSelected ? reports.length : 0
    });
  },

  // 单条勾选
  onReportCheck(e) {
    const { report, checked } = e.detail;
    const reports = this.data.reports.map(r => {
      if (r._id === report._id) {
        return { ...r, checked: checked };
      }
      return r;
    });

    const checkedCount = reports.filter(r => r.checked).length;
    
    this.setData({
      reports,
      selectedCount: checkedCount,
      allSelected: checkedCount === reports.length
    });
  },

  // 批量删除
  async handleBatchDelete() {
    if (this.data.selectedCount === 0) {
      wx.showToast({ title: '请先选择要删除的记录', icon: 'none' });
      return;
    }

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '⚠️ 危险操作',
        content: `确定删除已选的 ${this.data.selectedCount} 条记录吗？此操作不可恢复！`,
        confirmText: '确认删除',
        confirmColor: '#E74C3C',
        success: (res) => resolve(res.confirm)
      });
    });

    if (!confirmed) return;

    wx.showLoading({ title: '删除中...', mask: true });

    try {
      const selectedIds = this.data.reports
        .filter(r => r.checked)
        .map(r => r._id);

      await request.deleteReport(selectedIds);

      wx.hideLoading();
      wx.showToast({ title: `已删除 ${this.data.selectedCount} 条记录`, icon: 'success' });

      // 刷新列表
      this.page = 1;
      this.setData({
        reports: [],
        hasMore: true,
        allSelected: false,
        selectedCount: 0
      });
      this.loadReports();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '删除失败，请重试', icon: 'none' });
    }
  },

  // 导出Excel
  async handleExport() {
    if (this.data.selectedCount === 0) {
      wx.showToast({ title: '请先选择要导出的记录', icon: 'none' });
      return;
    }

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认导出',
        content: `确定导出已选的 ${this.data.selectedCount} 条记录吗？`,
        success: (res) => resolve(res.confirm)
      });
    });

    if (!confirmed) return;

    this.setData({ exporting: true });

    try {
      const selectedIds = this.data.reports
        .filter(r => r.checked)
        .map(r => r._id);

      const result = await request.exportExcel(selectedIds);

      if (result.success && result.downloadUrl) {
        // 下载文件
        wx.showModal({
          title: '导出成功',
          content: 'Excel文件已生成，点击确定下载文件。',
          confirmText: '下载',
          success: (res) => {
            if (res.confirm) {
              // 复制下载链接到剪贴板
              wx.setClipboardData({
                data: result.downloadUrl,
                success: () => {
                  wx.showToast({ title: '下载链接已复制', icon: 'success' });
                }
              });
            }
          }
        });
      } else {
        wx.showToast({ title: result.message || '导出失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: err.message || '导出失败，请重试', icon: 'none', duration: 3000 });
    }

    this.setData({ exporting: false });
  },

  // 点击记录
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
      url: `/pages/admin-edit/admin-edit?id=${report._id}`
    });
  },

  // 删除记录
  onReportDelete(e) {
    const { report } = e.detail;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条隐患记录吗？此操作不可恢复。',
      confirmColor: '#E74C3C',
      success: async (res) => {
        if (res.confirm) {
          try {
            await request.deleteReport(report._id);
            wx.showToast({ title: '删除成功', icon: 'success' });
            
            // 刷新列表
            this.page = 1;
            this.setData({ 
              reports: [], 
              hasMore: true,
              allSelected: false,
              selectedCount: 0
            });
            this.loadReports();
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  goToLogin() {
    wx.navigateTo({
      url: '/pages/admin-login/admin-login'
    });
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

  calcTodayCount(reports) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + 86400000;
    return reports.filter(r => {
      const t = new Date(r.createTime).getTime();
      return t >= todayStart && t < todayEnd;
    }).length;
  },

  calcMonthCount(reports) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return reports.filter(r => {
      return r.createTime && new Date(r.createTime).getTime() >= monthStart;
    }).length;
  },
});
