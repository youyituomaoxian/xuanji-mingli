/* 重建悬浮卡 zip：从 app.js 提取 FLOAT_PS1/FLOAT_BAT/FLOAT_README 模板，
   模拟 buildFloatZip 打包（不含 xuanji-data.json 快照——页面运行期生成），
   解包后对 float-card.ps1 做 UTF-8 BOM 落盘，供 PowerShell Parser 验证。 */
const fs = require('fs');
const path = require('path');

const ROOT = 'I:/workbuddy/公司分析/玄学工作台';
const appPath = path.join(ROOT, 'js', 'app.js');
const app = fs.readFileSync(appPath, 'utf8');

/* ---- 提取 JS 数组字面量模板：FLOAT_PS1 / FLOAT_BAT / FLOAT_README ----
   直接对数组字面量求值（纯字符串数组，无副作用），兼容单/双引号混合。
   用 indexOf 精确定位 [ ] 边界，避免正则被数组内部的 '];' 截断。 */
function extractArrayVar(src, name) {
  const start = src.indexOf(name + ' = [');
  if (start < 0) throw new Error('cannot find ' + name);
  const openBracket = start + name.length + 3; // 指向 '['
  const closeJoin = src.indexOf('].join(', openBracket);
  const arrLit = src.slice(openBracket, closeJoin + 1);
  // eslint-disable-next-line no-eval
  return eval('(' + arrLit + ')');
}

const ps1Lines = extractArrayVar(app, 'FLOAT_PS1');
const bat = extractArrayVar(app, 'FLOAT_BAT').join('\r\n');
const readme = extractArrayVar(app, 'FLOAT_README');

const ps1 = '\uFEFF' + ps1Lines.join('\n');
const json = null; // 快照由 buildSnapshotJson 生成，脚本模式无页面状态

/* ---- 极简 zip 打包（STORE 无压缩，浏览器 makeZip 同款策略） ---- */
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function makeZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6);  // flags
    local.writeUInt16LE(0, 8);  // method STORE
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0, 12); // date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cenStart = offset;
  const cenBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cenBuf.length, 12);
  eocd.writeUInt32LE(cenStart, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, cenBuf, eocd]);
}

/* ---- 输出 ---- */
const outDir = path.join(ROOT, '_test', 'float_zip_check');
fs.mkdirSync(outDir, { recursive: true });

const files = [
  { name: 'start-float-card.bat', data: Buffer.from(bat, 'utf8') },
  { name: 'float-card.ps1', data: Buffer.from(ps1, 'utf8') },
  { name: 'README-使用说明.txt', data: Buffer.from('\uFEFF' + readme.join('\n'), 'utf8') },
];
const zipBuf = makeZip(files);
fs.writeFileSync(path.join(outDir, '玄机运势卡.zip'), zipBuf);

/* ---- 解包 ---- */
const unzip = (buf) => {
  const files = {};
  let p = 0;
  while (p + 4 <= buf.length) {
    if (buf.readUInt32LE(p) !== 0x04034b50) break;
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    const size = buf.readUInt32LE(p + 18);
    const name = buf.slice(p + 30, p + 30 + nameLen).toString('utf8');
    const data = buf.slice(p + 30 + nameLen + extraLen, p + 30 + nameLen + extraLen + size);
    files[name] = data;
    p += 30 + nameLen + extraLen + size;
  }
  return files;
};

const extracted = unzip(zipBuf);
console.log('zip entries:', Object.keys(extracted));

// 落盘 PS1 与 BAT 供 PowerShell Parser 使用
fs.writeFileSync(path.join(outDir, 'float-card.ps1'), extracted['float-card.ps1']);
fs.writeFileSync(path.join(outDir, 'start-float-card.bat'), extracted['start-float-card.bat']);
fs.writeFileSync(path.join(outDir, 'README-使用说明.txt'), extracted['README-使用说明.txt']);

// 检查 BtnClose 修复是否在 zip 内
const ps1Text = extracted['float-card.ps1'].toString('utf8');
console.log('--- BtnClose line in zip ps1:', ps1Text.split('\n').filter(l => l.includes('BtnClose')).join(' | '));
console.log('--- BOM present:', extracted['float-card.ps1'][0] === 0xEF && extracted['float-card.ps1'][1] === 0xBB);
console.log('--- ps1 size:', extracted['float-card.ps1'].length);
console.log('OK: zip rebuilt at', path.join(outDir, '玄机运势卡.zip'));
