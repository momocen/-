// cloudfunctions/deleteReport/index.js - 删除隐患报告（支持单条和批量）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { id, ids } = event;

  // 统一转为数组
  let deleteIds = [];
  if (id) deleteIds = [id];
  if (ids && ids.length > 0) deleteIds = ids;

  if (deleteIds.length === 0) {
    return { success: false, message: '缺少记录ID' };
  }

  try {
    // 1. 先查询所有要删除的记录，收集关联图片
    const allFileIDs = [];
    const result = await db.collection('reports')
      .where({ _id: _.in(deleteIds) })
      .get();

    result.data.forEach(record => {
      if (record.hazardPhotos) allFileIDs.push(...record.hazardPhotos);
      if (record.acceptancePhotos) allFileIDs.push(...record.acceptancePhotos);
    });

    // 2. 批量删除数据库记录
    // 云数据库不支持直接 where _id in + remove，需要逐条删除
    const deletePromises = deleteIds.map(docId =>
      db.collection('reports').doc(docId).remove()
    );
    await Promise.all(deletePromises);

    // 3. 异步清理云存储图片
    if (allFileIDs.length > 0) {
      cloud.deleteFile({ fileList: allFileIDs })
        .then(res => console.log(`已清理 ${res.fileList.length} 张关联图片`))
        .catch(err => console.error('清理图片失败:', err));
    }

    return {
      success: true,
      deletedCount: deleteIds.length,
      message: `成功删除 ${deleteIds.length} 条记录`,
    };
  } catch (err) {
    console.error('删除报告失败:', err);
    return {
      success: false,
      message: '删除失败: ' + err.message,
    };
  }
};
