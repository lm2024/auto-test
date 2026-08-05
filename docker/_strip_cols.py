# -*- coding: utf-8 -*-
"""
从 init.sql 的 INSERT 语句中按列名删除指定列（列名列表 + 每个 VALUES 元组的对应位置）。
只处理带显式列名的 INSERT，保留其余全部数据不变。
"""
import io
import re
import sys

TARGETS = {
    'test_chain': ['current_version', 'chain_fingerprint'],
    'test_node_config': ['sort_no', 'parallel_group'],
}


def split_top_level(s):
    """按顶层逗号切分（跳过引号内内容与嵌套括号）"""
    parts = []
    buf = []
    depth = 0
    in_str = False
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if in_str:
            buf.append(c)
            if c == '\\':
                if i + 1 < n:
                    buf.append(s[i + 1])
                    i += 2
                    continue
            elif c == "'":
                # MySQL 也允许 '' 转义
                if i + 1 < n and s[i + 1] == "'":
                    buf.append("'")
                    i += 2
                    continue
                in_str = False
            i += 1
            continue
        if c == "'":
            in_str = True
            buf.append(c)
        elif c == '(':
            depth += 1
            buf.append(c)
        elif c == ')':
            depth -= 1
            buf.append(c)
        elif c == ',' and depth == 0:
            parts.append(''.join(buf))
            buf = []
        else:
            buf.append(c)
        i += 1
    parts.append(''.join(buf))
    return parts


def split_tuples(values_part):
    """把 (..),(..),(..) 切成一个个元组内容（不含最外层括号）"""
    tuples = []
    depth = 0
    in_str = False
    start = None
    i = 0
    n = len(values_part)
    while i < n:
        c = values_part[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == "'":
                if i + 1 < n and values_part[i + 1] == "'":
                    i += 2
                    continue
                in_str = False
            i += 1
            continue
        if c == "'":
            in_str = True
        elif c == '(':
            if depth == 0:
                start = i + 1
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0:
                tuples.append(values_part[start:i])
        i += 1
    return tuples


def process(sql, table, drop_cols):
    pattern = re.compile(
        r'INSERT INTO `' + re.escape(table) + r'` \((.*?)\) VALUES\s*',
        re.DOTALL)
    m = pattern.search(sql)
    if not m:
        print('  [skip] %s: 未找到带列名的 INSERT' % table)
        return sql, 0

    cols_raw = m.group(1)
    cols = [c.strip().strip('`') for c in cols_raw.split(',')]
    idx = [i for i, c in enumerate(cols) if c in drop_cols]
    if not idx:
        print('  [skip] %s: 目标列已不存在' % table)
        return sql, 0

    # 定位 VALUES 之后到结尾分号（兼容 CRLF / 文件末尾）
    body_start = m.end()
    tail = re.compile(r';\r?\n|;\s*$').search(sql, body_start)
    if not tail:
        raise SystemExit('  [FAIL] %s: 找不到语句结尾分号' % table)
    end = tail.start()
    values_part = sql[body_start:end]

    tuples = split_tuples(values_part)
    new_tuples = []
    for t in tuples:
        fields = split_top_level(t)
        if len(fields) != len(cols):
            raise SystemExit(
                '  [FAIL] %s: 字段数不匹配 期望%d 实际%d' % (table, len(cols), len(fields)))
        kept = [f for i, f in enumerate(fields) if i not in idx]
        new_tuples.append('(' + ','.join(kept) + ')')

    new_cols = [c for i, c in enumerate(cols) if i not in idx]
    new_stmt = ('INSERT INTO `%s` (%s) VALUES\n%s'
                % (table,
                   ', '.join('`%s`' % c for c in new_cols),
                   ',\n'.join(new_tuples)))
    sql = sql[:m.start()] + new_stmt + sql[end:]
    print('  [ok] %s: 删除列 %s，处理 %d 行' % (table, drop_cols, len(tuples)))
    return sql, len(tuples)


def main():
    path = sys.argv[1]
    with io.open(path, 'r', encoding='utf-8', newline='') as f:
        sql = f.read()
    for table, cols in TARGETS.items():
        sql, _ = process(sql, table, cols)
    out = sys.argv[2] if len(sys.argv) > 2 else path
    with io.open(out, 'w', encoding='utf-8', newline='') as f:
        f.write(sql)
    print('done ->', out)


if __name__ == '__main__':
    main()
