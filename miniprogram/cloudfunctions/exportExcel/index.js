// cloudfunctions/exportExcel/index.js - 导出隐患报告为Excel（图片嵌入单元格）
const cloud = require('wx-server-sdk');
const fs = require('fs');
const path = require('path');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const ExcelJS = require('exceljs');

// 图片显示尺寸（Excel 中单位是 pt，1pt ≈ 1.33px）
const IMG_HEIGHT = 100;   // 图片高度（pt）
const IMG_WIDTH = 130;    // 图片宽度（pt）
const ROW_PADDING = 20;   // 行内边距

/**
 * 从云存储下载图片到本地临时文件，返回 Buffer
 */
async function downloadImageAsBuffer(fileID) {
  try {
    const res = await cloud.downloadFile({ fileID });
    if (res.fileContent) {
      return res.fileContent;
    }
    // 如果没有 fileContent，尝试从 tempFilePath 读取
    if (res.tempFilePath) {
      return fs.readFileSync(res.tempFilePath);
    }
    return null;
  } catch (err) {
    console.error('下载图片失败:', fileID, err.message);
    return null;
  }
}

/**
 * 获取图片的实际宽高（通过简单分析 JPEG/PNG 头部）
 */
function getImageDimensions(buffer) {
  try {
    // PNG: 前8字节是签名，9-16是IHDR的width/height
    if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
    // JPEG: 查找 SOF0 marker (0xFF 0xC0)
    for (let i = 0; i < buffer.length - 9; i++) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xC0) {
        const height = buffer.readUInt16BE(i + 5);
        const width = buffer.readUInt16BE(i + 7);
        return { width, height };
      }
    }
    // 默认值
    return { width: 400, height: 600 };
  } catch (e) {
    return { width: 400, height: 600 };
  }
}

exports.main = async (event, context) => {
  const { ids } = event;

  if (!ids || ids.length === 0) {
    return { success: false, message: '请选择要导出的记录' };
  }

  try {
    // 1. 从数据库获取记录
    const _ = db.command;
    const result = await db.collection('reports')
      .where({ _id: _.in(ids) })
      .orderBy('createTime', 'desc')
      .get();

    const reports = result.data;

    if (reports.length === 0) {
      return { success: false, message: '未找到选中的记录' };
    }

    // 2. 预先下载所有图片
    // imageBufferMap: { fileID: { buffer, width, height } }
    const imageBufferMap = {};
    const allImageIDs = new Set();
    reports.forEach(report => {
      (report.hazardPhotos || []).forEach(id => allImageIDs.add(id));
      (report.acceptancePhotos || []).forEach(id => allImageIDs.add(id));
    });

    // 并行下载所有图片（单张失败不阻塞整体）
    const downloadTasks = Array.from(allImageIDs).map(async (fileID) => {
      try {
        const buffer = await downloadImageAsBuffer(fileID);
        if (buffer) {
          const dims = getImageDimensions(buffer);
          imageBufferMap[fileID] = { buffer, width: dims.width, height: dims.height };
        }
      } catch (err) {
        console.error('下载图片失败，跳过:', fileID);
      }
    });
    await Promise.all(downloadTasks);

    // 3. 创建 Excel 工作簿
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '安全隐患排查上报系统';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('隐患报告导出', {
      properties: { tabColor: { argb: 'FF1AAD19' } },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    // 4. 定义列宽
    worksheet.columns = [
      { header: '序号', key: 'seq', width: 6 },
      { header: '一级部门', key: 'department1', width: 14 },
      { header: '二级部门', key: 'department2', width: 14 },
      { header: '地点', key: 'location', width: 25 },
      { header: '隐患照片', key: 'hazardPhotos', width: 22 },     // 图片列加宽
      { header: '隐患说明', key: 'hazardDescription', width: 35 },
      { header: '隐患产生的原因分析', key: 'causeAnalysis', width: 30 },
      { header: '建议整改措施/要求', key: 'suggestedMeasures', width: 30 },
      { header: '验收照片', key: 'acceptancePhotos', width: 22 },  // 图片列加宽
      { header: '验收人及验收时间', key: 'acceptanceInfo', width: 22 },
      { header: '报告人', key: 'reporter', width: 12 },
      { header: '报告人工号', key: 'reporterId', width: 12 },
    ];

    // 5. 设置表头样式
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1AAD19' },
      };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: '微软雅黑' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    });

    // 6. 填充数据行（嵌入图片）
    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];
      const rowIndex = i + 2; // 第1行是表头，数据从第2行开始
      const row = worksheet.getRow(rowIndex);

      // 统计该行有多少张图片，决定行高
      const hazardCount = (report.hazardPhotos || []).length;
      const acceptanceCount = (report.acceptancePhotos || []).length;
      const maxImages = Math.max(hazardCount, acceptanceCount, 1);
      // 行高 = 图片高度 × 图片数量 + 内边距
      const rowHeight = Math.max(IMG_HEIGHT * maxImages + ROW_PADDING, 80);
      row.height = rowHeight;

      // 验收人及时间
      const acceptanceInfo = `${report.acceptor || ''} / ${report.acceptanceTime || ''}`;

      // 写入文本数据
      row.values = [
        i + 1,                          // 1. 序号
        report.department1 || '',       // 2. 一级部门
        report.department2 || '',       // 3. 二级部门
        report.location || '',          // 4. 地点
        '',                             // 5. 隐患照片 — 下面用图片填充
        report.hazardDescription || '', // 6. 隐患说明
        report.causeAnalysis || '',     // 7. 隐患产生的原因分析
        report.suggestedMeasures || '', // 8. 建议整改措施/要求
        '',                             // 9. 验收照片 — 下面用图片填充
        acceptanceInfo,                 // 10. 验收人及验收时间
        report.reporter || '',          // 11. 报告人
        report.reporterId || '',        // 12. 报告人工号
      ];

      // 设置所有单元格基础样式
      row.eachCell((cell, colNumber) => {
        cell.font = { size: 10, name: '微软雅黑' };
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });

      // ---- 嵌入隐患照片（第5列）----
      if (hazardCount > 0) {
        for (let j = 0; j < hazardCount; j++) {
          const fileID = report.hazardPhotos[j];
          const imgData = imageBufferMap[fileID];
          if (imgData && imgData.buffer) {
            try {
              const imageId = workbook.addImage({
                buffer: imgData.buffer,
                extension: 'jpeg',
              });
              // 图片锚定位置：列 E (col=4, 0-based)，行偏移按 j 叠加
              worksheet.addImage(imageId, {
                tl: { col: 4, row: rowIndex - 1 + j * (IMG_HEIGHT / rowHeight) },
                ext: { width: IMG_WIDTH, height: IMG_HEIGHT },
              });
            } catch (e) {
              // 图片嵌入失败，回退填 fileID
              const cell = row.getCell(5);
              cell.value = (cell.value || '') + fileID + '\n';
            }
          } else {
            // 无缓冲，填 fileID 文本
            const cell = row.getCell(5);
            cell.value = (cell.value || '') + '[图片] ' + fileID + '\n';
          }
        }
      }

      // ---- 嵌入验收照片（第9列）----
      if (acceptanceCount > 0) {
        for (let j = 0; j < acceptanceCount; j++) {
          const fileID = report.acceptancePhotos[j];
          const imgData = imageBufferMap[fileID];
          if (imgData && imgData.buffer) {
            try {
              const imageId = workbook.addImage({
                buffer: imgData.buffer,
                extension: 'jpeg',
              });
              worksheet.addImage(imageId, {
                tl: { col: 8, row: rowIndex - 1 + j * (IMG_HEIGHT / rowHeight) },
                ext: { width: IMG_WIDTH, height: IMG_HEIGHT },
              });
            } catch (e) {
              const cell = row.getCell(9);
              cell.value = (cell.value || '') + fileID + '\n';
            }
          } else {
            const cell = row.getCell(9);
            cell.value = (cell.value || '') + '[图片] ' + fileID + '\n';
          }
        }
      }

      // 如果有文本回退内容，重设第5列和第9列的对齐
      const cell5 = row.getCell(5);
      const cell9 = row.getCell(9);
      [cell5, cell9].forEach(cell => {
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        cell.font = { size: 9, name: '微软雅黑', color: { argb: 'FF888888' } };
      });
    }

    // 7. 生成 Excel buffer
    let buffer;
    try {
      buffer = await workbook.xlsx.writeBuffer();
    } catch (genErr) {
      console.error('生成Excel文件失败:', genErr);
      return {
        success: false,
        message: '生成Excel文件失败，图片过多可能导致内存不足，请减少选中记录数后重试',
      };
    }

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

    return {
      success: true,
      fileID: uploadResult.fileID,
      downloadUrl: downloadResult.fileList[0]?.tempFileURL || '',
      fileName: fileName,
      totalCount: reports.length,
      message: `成功导出 ${reports.length} 条记录（含 ${allImageIDs.size} 张图片）`,
    };
  } catch (err) {
    console.error('导出Excel失败:', err);
    return {
      success: false,
      message: '导出失败: ' + err.message,
    };
  }
};
