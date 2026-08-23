// cloudfunctions/initDatabase/index.js - 数据库初始化（在云开发控制台手动运行一次）
// 使用方法：在微信开发者工具中，右键此云函数 → 上传并部署 → 云端测试
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const crypto = require('crypto');

exports.main = async (event, context) => {
  const results = {};

  try {
    // 1. 创建 reports 集合（隐患报告）
    try {
      await db.createCollection('reports');
      results.reports = '集合 reports 创建成功';
    } catch (e) {
      results.reports = '集合 reports 已存在: ' + e.message;
    }

    // 2. 创建 admin_users 集合（管理员用户）
    try {
      await db.createCollection('admin_users');
      results.admin_users = '集合 admin_users 创建成功';
    } catch (e) {
      results.admin_users = '集合 admin_users 已存在: ' + e.message;
    }

    // 3. 创建 users 集合（微信用户）
    try {
      await db.createCollection('users');
      results.users = '集合 users 创建成功';
    } catch (e) {
      results.users = '集合 users 已存在: ' + e.message;
    }

    // 4. 初始化管理员账号 Lier / ABC-123
    const adminRes = await db.collection('admin_users').where({ username: 'Lier' }).get();
    if (adminRes.data.length === 0) {
      const hashedPassword = crypto.createHash('sha256').update('ABC-123').digest('hex');
      await db.collection('admin_users').add({
        data: {
          username: 'Lier',
          password: hashedPassword,
          isInitialPassword: true,
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
        }
      });
      results.adminInit = '管理员账号 Lier 创建成功（初始密码: ABC-123）';
    } else {
      results.adminInit = '管理员账号 Lier 已存在';
    }

    return {
      success: true,
      message: '数据库初始化完成',
      results: results,
    };
  } catch (err) {
    return {
      success: false,
      message: '初始化失败: ' + err.message,
    };
  }
};
