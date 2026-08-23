// cloudfunctions/deleteReport/index.js - 删除隐患报告
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { id } = event;

  if (!id) {
    return { success: false, message: '缺少记录ID' };
  }

  try {
    // 先获取记录以清理关联图片
    const record = await db.collection('reports').doc(id).get();
    
    if (!record.data) {
      return { success: false, message: '记录不存在' };
    }

    // 收集所有要删除的图片文件ID
    const fileIDs = [];
    if (record.data.hazardPhotos && record.data.hazardPhotos.length > 0) {
      fileIDs.push(...record.data.hazardPhotos);
    }
    if (record.data.acceptancePhotos && record.data.acceptancePhotos.length > 0) {
      fileIDs.push(...record.data.acceptancePhotos);
    }

    // 删除数据库记录
    await db.collection('reports').doc(id).remove();

    // 异步删除云存储中的图片（不等待结果）
    if (fileIDs.length > 0) {
      cloud.deleteFile({
        fileList: fileIDs,
      }).then(res => {
        console.log('关联图片已删除:', res.fileList);
      }).catch(err => {
        console.error('删除关联图片失败:', err);
      });
    }

    return {
      success: true,
      message: '删除成功',
    };
  } catch (err) {
    console.error('删除报告失败:', err);
    return {
      success: false,
      message: '删除失败: ' + err.message,
    };
  }
};
