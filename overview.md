# 员工安全隐患排查上报系统 — 项目概览

## 项目完成状态

✅ 全部 7 个核心模块已完成开发和文件创建

## 一、技术架构

| 层级 | 技术选型 |
|------|----------|
| **前端框架** | 微信小程序原生（WXML + WXSS + JS） |
| **后端服务** | 微信云开发（CloudBase） |
| **数据库** | 云开发数据库（MongoDB 兼容） |
| **图片存储** | 云存储（Cloud Storage） |
| **图片压缩** | Canvas + wx.compressImage，压缩至 400×600 |
| **Excel导出** | 云函数 + exceljs 库 |

## 二、项目结构（65个文件）

### 小程序端（8个页面 + 2个自定义组件 + 3个工具类）

```
miniprogram/
├── app.js / app.json / app.wxss         # 全局配置
├── project.config.json                   # 开发者工具配置
├── components/                           # 自定义组件
│   ├── image-uploader/                   # 图片上传（含压缩）
│   └── report-card/                      # 隐患记录卡片
├── pages/
│   ├── index/                            # 首页（登录入口）
│   ├── report/                           # 隐患上报表单
│   ├── my-reports/                       # 我的记录（用户个人中心）
│   ├── report-detail/                    # 隐患详情
│   ├── admin-login/                      # 管理员登录
│   ├── admin-dashboard/                  # 管理后台 + Excel导出
│   ├── admin-edit/                       # 管理员编辑记录
│   └── change-password/                  # 修改密码
└── utils/
    ├── auth.js                           # 认证管理
    ├── request.js                        # 云函数调用封装
    └── image.js                          # 图片压缩与上传
```

### 云函数端（8个云函数）

```
cloudfunctions/
├── login/           # 微信用户登录（wx.login → openid）
├── adminLogin/      # 管理员账号密码登录（Lier / ABC-123）
├── submitReport/    # 提交隐患报告（含必填校验）
├── getReports/      # 获取报告列表（支持分页、统计）
├── updateReport/    # 更新隐患报告
├── deleteReport/    # 删除报告 + 关联图片清理
├── changePassword/  # 修改管理员密码（SHA256加密）
├── exportExcel/     # 导出Excel（含图片链接）
├── getUserInfo/     # 获取用户信息
└── initDatabase/    # 数据库初始化（创建集合+管理员账号）
```

## 三、功能清单

| 模块 | 功能点 | 状态 |
|------|--------|------|
| **用户登录** | 微信授权一键登录 | ✅ |
| **用户登录** | 管理员账号密码登录（Lier/ABC-123） | ✅ |
| **用户登录** | 首次登录后修改密码 | ✅ |
| **隐患上报** | 完整表单（12个字段，6个必填） | ✅ |
| **隐患上报** | 图片拍照/相册选择 | ✅ |
| **隐患上报** | 图片自动压缩至400×600 | ✅ |
| **隐患上报** | 地图选点 | ✅ |
| **个人中心** | 查看本人提交的记录列表 | ✅ |
| **个人中心** | 编辑/删除自己的记录 | ✅ |
| **个人中心** | 统计（总数、本月数） | ✅ |
| **管理后台** | 查看所有用户记录 | ✅ |
| **管理后台** | 全选 + 勾选导出Excel | ✅ |
| **管理后台** | 修改/删除任意记录 | ✅ |
| **管理后台** | 统计（总数、今日、本月） | ✅ |

## 四、Excel导出格式

| 列序 | 列名 |
|------|------|
| 1 | 序号（自动生成） |
| 2 | 一级部门 |
| 3 | 二级部门 |
| 4 | 隐患照片（超链接） |
| 5 | 地点 |
| 6 | 隐患说明 |
| 7 | 隐患产生的原因分析 |
| 8 | 建议整改措施/要求 |
| 9 | 验收照片（超链接） |
| 10 | 验收人及验收时间 |
| 11 | 报告人 |
| 12 | 报告人工号 |

## 五、数据库设计

### reports 集合（隐患报告）
| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| openid | string | 提交用户openid |
| department1/2 | string | 一级/二级部门 |
| location | string | 地点（必填） |
| hazardPhotos | array | 隐患照片 fileID 数组（必填） |
| hazardDescription | string | 隐患说明（必填） |
| causeAnalysis | string | 原因分析 |
| suggestedMeasures | string | 整改建议 |
| acceptancePhotos | array | 验收照片 fileID 数组（必填） |
| acceptor | string | 验收人（必填） |
| acceptanceTime | string | 验收时间（必填） |
| reporter | string | 报告人（必填） |
| reporterId | string | 报告人工号（必填） |
| createTime | date | 创建时间 |
| updateTime | date | 更新时间 |

### admin_users 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| username | string | 管理员账号 |
| password | string | SHA256加密密码 |
| isInitialPassword | boolean | 是否初始密码 |

## 六、部署步骤

1. **替换 AppID**：修改 `project.config.json` 中的 `appid` 为你的小程序AppID
2. **开通云开发**：在微信开发者工具中开通云开发，获取环境ID
3. **替换环境ID**：修改 `miniprogram/app.js` 中的 `env: 'your-env-id'` 
4. **安装云函数依赖**：对每个云函数目录执行 `npm install`
5. **上传云函数**：右键每个云函数 → 上传并部署
6. **初始化数据库**：运行 `initDatabase` 云函数创建集合和管理员账号
7. **上传图片资源**：为 tabBar 准备图标（home/report/user 各2张）
8. **配置云存储权限**：设置云存储读写权限（建议"所有用户可读，仅创建者可写"）
9. **编译预览**：在开发者工具中编译并预览
