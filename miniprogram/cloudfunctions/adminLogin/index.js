// cloudfunctions/adminLogin/index.js - 管理员登录
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const INITIAL_USERNAME = 'Lier';
const INITIAL_PASSWORD = 'ABC-123';

exports.main = async (event, context) => {
  const { username, password } = event;

  if (!username || !password) {
    return { success: false, message: '请输入账号和密码' };
  }

  try {
    // 查询管理员用户（如果集合不存在会自动兜底）
    let res;
    try {
      res = await db.collection('admin_users').where({ username }).get();
    } catch (err) {
      // admin_users 集合不存在，继续走兜底逻辑
      res = { data: [] };
    }

    if (res.data.length === 0) {
      // 如果还不存在管理员记录，检查是否为初始账号
      if (username === INITIAL_USERNAME && password === INITIAL_PASSWORD) {
        // 创建初始管理员记录
        const crypto = require('crypto');
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        
        await db.collection('admin_users').add({
          data: {
            username: INITIAL_USERNAME,
            password: hashedPassword,
            isInitialPassword: true,
            createTime: db.serverDate(),
            updateTime: db.serverDate(),
          }
        });

        return {
          success: true,
          token: 'admin_' + Date.now(),
          adminUser: { username: INITIAL_USERNAME },
          isFirstLogin: true,
        };
      }
      
      // 也查一下users集合（兼容老数据）
      const userRes = await db.collection('users').where({ 
        username, 
        userType: 'admin' 
      }).get();
      
      if (userRes.data.length > 0) {
        const user = userRes.data[0];
        if (user.password === password) {
          return {
            success: true,
            token: 'admin_' + Date.now(),
            adminUser: { username },
            isFirstLogin: false,
          };
        }
      }
      
      return { success: false, message: '账号或密码错误' };
    }

    const admin = res.data[0];
    const crypto = require('crypto');
    const hashedInput = crypto.createHash('sha256').update(password).digest('hex');

    if (admin.password !== hashedInput) {
      return { success: false, message: '账号或密码错误' };
    }

    return {
      success: true,
      token: 'admin_' + Date.now(),
      adminUser: { username: admin.username },
      isFirstLogin: admin.isInitialPassword || false,
    };
  } catch (err) {
    console.error('管理员登录失败:', err);
    return { success: false, message: '登录失败: ' + err.message };
  }
};
