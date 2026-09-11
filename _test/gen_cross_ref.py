#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 pai_pan.py 的批量排盘基准数据，用于交叉校验 JS 引擎。

输出 cross_ref.json: [{input, year, month, day, hour_pillar, dayun, qiyun, shensha}]
"""
import json
import random
import sys
from datetime import date

sys.path.insert(0, r'I:/workbuddy/公司分析/_skills/bazi-skill/scripts')
import pai_pan as P

random.seed(20260910)

cases = []
# 固定锚点
fixed = [
    (1990, 5, 15, 12, 0, '男'),
    (1990, 2, 3, 10, 0, '男'),
    (1984, 2, 4, 23, 30, '女'),
    (2000, 1, 1, 0, 30, '男'),
    (2025, 1, 29, 6, 15, '女'),
    (1976, 8, 8, 14, 20, '男'),
    (1995, 12, 22, 3, 0, '女'),
    (1968, 6, 6, 18, 45, '男'),
    (2003, 11, 7, 21, 10, '女'),
    (1955, 3, 21, 9, 5, '男'),
]
for f in fixed:
    cases.append(f)

# 随机补足（覆盖 1900-2060，含各种时辰边界）
for _ in range(60):
    y = random.randint(1905, 2055)
    m = random.randint(1, 12)
    d = random.randint(1, 28)
    h = random.choice([0, 1, 2, 3, 5, 6, 7, 9, 11, 12, 13, 15, 17, 19, 21, 22, 23])
    mi = random.choice([0, 15, 30, 45])
    sex = random.choice(['男', '女'])
    cases.append((y, m, d, h, mi, sex))

out = []
errors = []
for (y, m, d, h, mi, sex) in cases:
    try:
        r = P.compute(date(y, m, d), hour=h, minute=mi, sex=sex)
        out.append({
            'input': {'y': y, 'm': m, 'd': d, 'h': h, 'mi': mi, 'sex': sex},
            'year_pillar': r['pillars']['year'][0] + r['pillars']['year'][1],
            'month_pillar': r['pillars']['month'][0] + r['pillars']['month'][1],
            'day_pillar': r['pillars']['day'][0] + r['pillars']['day'][1],
            'hour_pillar': (r['pillars']['hour'][0] + r['pillars']['hour'][1]) if r['pillars']['hour'][0] != '未知' else '未知',
            'qiyun_text': r['qiyun_text'],
            'dayun': [row[2] for row in r['dayun_rows']],
            'shensha': [l.split(' —')[0] for l in r['shensha_lines']],
            'lunar_text': r['lunar_text'],
        })
    except Exception as e:
        errors.append((y, m, d, h, mi, sex, str(e)))

with open(r'I:/workbuddy/公司分析/玄学工作台/_test/cross_ref.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

print('生成基准用例:', len(out), '失败:', len(errors))
for e in errors[:8]:
    print('  ERR', e)
