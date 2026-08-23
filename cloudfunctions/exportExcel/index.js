// cloudfunctions/exportExcel/index.js - 导出隐患报告为Excel
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const ExcelJS = require('exceljs');

exports.main = async (event, context) => {
  const { ids } = event;

  if (!ids || ids.length === 0) {
    return { success: false, message: '请选择要导出的记录' };
  }

  try {
    // 1. 从数据库获取记录
    const _ = db.command;
    const result = await db.collection('reports')
      .where({
        _id: _.in(ids)
      })
      .orderBy('createTime', 'desc')
      .get();

    const reports = result.data;

    if (reports.length === 0) {
      return { success: false, message: '未找到选中的记录' };
    }

    // 2. 获取所有图片的临时链接
    const allImageIDs = [];
    reports.forEach(report => {
      if (report.hazardPhotos && report.hazardPhotos.length > 0) {
        allImageIDs.push(...report.hazardPhotos);
      }
      if (report.acceptancePhotos && report.acceptancePhotos.length > 0) {
        allImageIDs.push(...report.acceptancePhotos);
      }
    });

    // 获取图片临时下载链接（批量，每次最多50个）
    let imageUrlMap = {};
    if (allImageIDs.length > 0) {
      // 分批获取
      const batchSize = 50;
      for (let i = 0; i < allImageIDs.length; i += batchSize) {
        const batch = allImageIDs.slice(i, i + batchSize);
        const urlResult = await cloud.getTempFileURL({ fileList: batch });
        urlResult.fileList.forEach(item => {
          if (item.tempFileURL) {
            imageUrlMap[item.fileID] = item.tempFileURL;
          }
        });
      }
    }

    // 3. 创建Excel工作簿
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '安全隐患排查上报系统';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('隐患报告导出', {
      properties: { tabColor: { argb: 'FF1AAD19' } },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    // 4. 定义列
    worksheet.columns = [
      { header: '序号', key: 'seq', width: 8 },
      { header: '一级部门', key: 'department1', width: 18 },
      { header: '二级部门', key: 'department2', width: 18 },
      { header: '隐患照片', key: 'hazardPhotos', width: 40 },
      { header: '地点', key: 'location', width: 30 },
      { header: '隐患说明', key: 'hazardDescription', width: 40 },
      { header: '隐患产生的原因分析', key: 'causeAnalysis', width: 35 },
      { header: '建议整改措施/要求', key: 'suggestedMeasures', width: 35 },
      { header: '验收照片', key: 'acceptancePhotos', width: 40 },
      { header: '验收人及验收时间', key: 'acceptanceInfo', width: 25 },
      { header: '报告人', key: 'reporter', width: 15 },
      { header: '报告人工号', key: 'reporterId', width: 15 },
    ];

    // 5. 设置表头样式
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1AAD19' },
      };
      cell.font = {
        color: { argb: 'FFFFFFFF' },
        bold: true,
        size: 12,
        name: '微软雅黑',
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // 6. 填充数据行
    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];
      const rowIndex = i + 2; // 从第2行开始（第1行是表头）
      const row = worksheet.getRow(rowIndex);

      // 获取隐患照片链接（多个用换行分隔）
      const hazardPhotoUrls = (report.hazardPhotos || [])
        .map(id => imageUrlMap[id] || id)
        .join('\n');

      // 获取验收照片链接
      const acceptancePhotoUrls = (report.acceptancePhotos || [])
        .map(id => imageUrlMap[id] || id)
        .join('\n');

      // 验收人及验收时间
      const acceptanceInfo = `${report.acceptor || ''} / ${report.acceptanceTime || ''}`;

      row.values = [
        i + 1,                           // 序号
        report.department1 || '',
        report.department2 || '',
        hazardPhotoUrls,                 // 隐患照片链接
        report.location || '',
        report.hazardDescription || '',
        report.causeAnalysis || '',
        report.suggestedMeasures || '',
        acceptancePhotoUrls,             // 验收照片链接
        acceptanceInfo,
        report.reporter || '',
        report.reporterId || '',
      ];

      // 设置行样式
      row.height = 80; // 较高的行高以容纳图片链接和多行文本
      row.eachCell((cell, colNumber) => {
        cell.font = {
          size: 11,
          name: '微软雅黑',
        };
        cell.alignment = {
          vertical: 'top',
          horizontal: 'left',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // 图片列设置特殊样式
        if (colNumber === 4 || colNumber === 10) {
          cell.font = {
            size: 10,
            name: '微软雅黑',
            color: { argb: 'FF1AAD19' },
            underline: true,
          };
        }
      });
    }

    // 7. 生成Excel文件buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // 8. 上传到云存储
    const fileName = `exports/隐患报告导出_${Date.now()}.xlsx`;
    const uploadResult = await cloud.uploadFile({
      cloudPath: fileName,
      fileContent: buffer,
    });

    // 9. 获取下载链接
    const downloadResult = await cloud.getTempFileURL({
      fileList: [uploadResult.fileID],
    });

    const downloadUrl = downloadResult.fileList[0]?.tempFileURL || '';

    return {
      success: true,
      fileID: uploadResult.fileID,
      downloadUrl: downloadUrl,
      fileName: fileName,
      totalCount: reports.length,
      message: `成功导出 ${reports.length} 条记录`,
    };
  } catch (err) {
    console.error('导出Excel失败:', err);
    return {
      success: false,
      message: '导出失败: ' + err.message,
    };
  }
};
