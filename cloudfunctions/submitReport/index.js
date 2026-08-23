// cloudfunctions/submitReport/index.js - 提交隐患报告
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  const {
    department1,
    department2,
    location,
    hazardPhotos,
    hazardDescription,
    causeAnalysis,
    suggestedMeasures,
    acceptancePhotos,
    acceptor,
    acceptanceTime,
    reporter,
    reporterId,
  } = event;

  // 必填字段校验
  if (!location) {
    return { success: false, message: '地点为必填项' };
  }
  if (!hazardDescription) {
    return { success: false, message: '隐患说明为必填项' };
  }
  if (!hazardPhotos || hazardPhotos.length === 0) {
    return { success: false, message: '隐患照片为必填项' };
  }
  if (!acceptancePhotos || acceptancePhotos.length === 0) {
    return { success: false, message: '验收照片为必填项' };
  }
  if (!acceptor || !acceptanceTime) {
    return { success: false, message: '验收人及验收时间为必填项' };
  }
  if (!reporter) {
    return { success: false, message: '报告人为必填项' };
  }
  if (!reporterId) {
    return { success: false, message: '报告人工号为必填项' };
  }

  try {
    const reportData = {
      openid: openid,
      department1: department1 || '',
      department2: department2 || '',
      location: location,
      hazardPhotos: hazardPhotos,
      hazardDescription: hazardDescription,
      causeAnalysis: causeAnalysis || '',
      suggestedMeasures: suggestedMeasures || '',
      acceptancePhotos: acceptancePhotos,
      acceptor: acceptor,
      acceptanceTime: acceptanceTime,
      reporter: reporter,
      reporterId: reporterId,
      status: 'pending',
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
    };

    const result = await db.collection('reports').add({
      data: reportData,
    });

    return {
      success: true,
      id: result._id,
      message: '隐患报告提交成功',
    };
  } catch (err) {
    console.error('提交报告失败:', err);
    return {
      success: false,
      message: '提交失败: ' + err.message,
    };
  }
};
