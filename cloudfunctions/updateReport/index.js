// cloudfunctions/updateReport/index.js - 更新隐患报告
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { id } = event;

  if (!id) {
    return { success: false, message: '缺少记录ID' };
  }

  try {
    // 检查记录是否存在
    const existResult = await db.collection('reports').doc(id).get();
    if (!existResult.data) {
      return { success: false, message: '记录不存在' };
    }

    // 构建更新数据
    const updateData = {
      department1: event.department1 || '',
      department2: event.department2 || '',
      location: event.location,
      hazardPhotos: event.hazardPhotos || [],
      hazardDescription: event.hazardDescription,
      causeAnalysis: event.causeAnalysis || '',
      suggestedMeasures: event.suggestedMeasures || '',
      acceptancePhotos: event.acceptancePhotos || [],
      acceptor: event.acceptor,
      acceptanceTime: event.acceptanceTime,
      reporter: event.reporter,
      reporterId: event.reporterId,
      updateTime: db.serverDate(),
    };

    // 删除旧照片（如果有变更）
    // 注：为避免误删共享图片，仅当完全变更时才清理旧图片
    // 生产环境中建议定期清理未引用的图片

    await db.collection('reports').doc(id).update({
      data: updateData,
    });

    return {
      success: true,
      message: '更新成功',
    };
  } catch (err) {
    console.error('更新报告失败:', err);
    return {
      success: false,
      message: '更新失败: ' + err.message,
    };
  }
};
