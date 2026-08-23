// cloudfunctions/changePassword/index.js - 修改管理员密码
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const crypto = require('crypto');

exports.main = async (event, context) => {
  const { username, oldPassword, newPassword } = event;

  if (!username || !oldPassword || !newPassword) {
    return { success: false, message: '参数不完整' };
  }

  if (newPassword.length < 6) {
    return { success: false, message: '新密码至少需要6位' };
  }

  try {
    const res = await db.collection('admin_users').where({ username }).get();

    if (res.data.length === 0) {
      return { success: false, message: '管理员账号不存在' };
    }

    const admin = res.data[0];
    const hashedOld = crypto.createHash('sha256').update(oldPassword).digest('hex');

    if (admin.password !== hashedOld) {
      return { success: false, message: '当前密码不正确' };
    }

    const hashedNew = crypto.createHash('sha256').update(newPassword).digest('hex');

    await db.collection('admin_users').doc(admin._id).update({
      data: {
        password: hashedNew,
        isInitialPassword: false,
        updateTime: db.serverDate(),
      }
    });

    return {
      success: true,
      message: '密码修改成功',
    };
  } catch (err) {
    console.error('修改密码失败:', err);
    return {
      success: false,
      message: '修改失败: ' + err.message,
    };
  }
};
