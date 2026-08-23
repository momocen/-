// cloudfunctions/getReports/index.js - 获取隐患报告列表
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

/**
 * 批量将云存储 fileID 转为 https URL（每次最多50个）
 */
async function convertFileIDsToURLs(records) {
  // 收集所有 cloud:// 开头的 fileID
  const fileIDSet = new Set();
  records.forEach(r => {
    [r.hazardPhotos, r.acceptancePhotos].forEach(list => {
      if (!Array.isArray(list)) return;
      list.forEach(p => {
        if (typeof p === 'string' && p.startsWith('cloud://')) {
          fileIDSet.add(p.trim());
        } else if (p && typeof p === 'object' && p.fileID && typeof p.fileID === 'string' && p.fileID.startsWith('cloud://')) {
          fileIDSet.add(p.fileID.trim());
        }
      });
    });
  });

  const fileIDs = Array.from(fileIDSet);
  if (fileIDs.length === 0) return records;

  const urlMap = {};
  const batchSize = 50;
  for (let i = 0; i < fileIDs.length; i += batchSize) {
    const batch = fileIDs.slice(i, i + batchSize);
    try {
      const res = await cloud.getTempFileURL({ fileList: batch });
      if (res.fileList) {
        res.fileList.forEach(f => {
          urlMap[f.fileID] = f.tempFileURL || f.fileID;
        });
      }
    } catch (err) {
      console.error('getTempFileURL 失败:', err);
    }
  }

  // 替换记录中的 fileID 为 URL
  return records.map(r => {
    const replace = (list) => {
      if (!Array.isArray(list)) return list;
      return list.map(p => {
        if (typeof p === 'string' && p.startsWith('cloud://')) {
          return urlMap[p.trim()] || p;
        }
        if (p && typeof p === 'object' && p.fileID && typeof p.fileID === 'string') {
          return { ...p, url: urlMap[p.fileID.trim()] || p.fileID };
        }
        return p;
      });
    };
    return {
      ...r,
      hazardPhotos: replace(r.hazardPhotos),
      acceptancePhotos: replace(r.acceptancePhotos),
    };
  });
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  const { openid, id, page = 1, pageSize = 20, isAdmin } = event;

  try {
    // 查询单条记录
    if (id) {
      const result = await db.collection('reports').doc(id).get();
      const data = result.data ? [result.data] : [];
      const converted = await convertFileIDsToURLs(data);
      return {
        success: true,
        data: converted,
        total: result.data ? 1 : 0,
      };
    }

    // 构建查询条件
    let where = {};

    // 管理员模式：不传 openid 则查全部；传了则按指定 openid 查
    // 普通用户模式：强制用云函数上下文的 openid（最可靠，不依赖前端传值）
    if (isAdmin) {
      if (openid) {
        where.openid = openid;
      }
      // 管理员不传 openid = 查全部
    } else {
      // 普通用户：优先用前端传的 openid，其次用云函数上下文
      const queryOpenid = openid || callerOpenid;
      if (queryOpenid) {
        where.openid = queryOpenid;
      }
      // 如果连 callerOpenid 都没有，返回空（openid 获取失败）
      if (!queryOpenid) {
        return {
          success: true,
          data: [],
          total: 0,
          page: 1,
          pageSize: pageSize,
          monthCount: 0,
          todayCount: 0,
        };
      }
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

    // 把图片 fileID 转成 https URL（云函数有权限，避免前端因权限/过期无法访问）
    const convertedData = await convertFileIDsToURLs(result.data);

    return {
      success: true,
      data: convertedData,
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
