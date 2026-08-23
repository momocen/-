// cloudfunctions/getReports/index.js - 获取隐患报告列表
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { openid, id, page = 1, pageSize = 20 } = event;

  try {
    // 查询单条记录
    if (id) {
      const result = await db.collection('reports').doc(id).get();
      return {
        success: true,
        data: result.data ? [result.data] : [],
        total: result.data ? 1 : 0,
      };
    }

    // 构建查询条件
    let where = {};
    
    // 如果指定了openid，则只查询该用户的记录
    if (openid) {
      where.openid = openid;
    }

    // 分页查询
    const skip = (page - 1) * pageSize;
    
    // 获取总数
    const countResult = await db.collection('reports').where(where).count();
    const total = countResult.total;

    // 获取数据（按创建时间倒序）
    const result = await db.collection('reports')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 统计本月数据
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCountResult = await db.collection('reports')
      .where({
        ...where,
        createTime: _.gte(monthStart)
      })
      .count();

    // 统计今日数据
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const todayCountResult = await db.collection('reports')
      .where({
        ...where,
        createTime: _.gte(todayStart).and(_.lt(todayEnd))
      })
      .count();

    return {
      success: true,
      data: result.data,
      total: total,
      page: page,
      pageSize: pageSize,
      monthCount: monthCountResult.total,
      todayCount: todayCountResult.total,
    };
  } catch (err) {
    console.error('获取报告列表失败:', err);
    return {
      success: false,
      message: '获取数据失败: ' + err.message,
    };
  }
};
