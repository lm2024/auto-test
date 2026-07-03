#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成三份面向领导汇报的 PPT 方案。"""

from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

OUTPUT_DIR = Path(__file__).parent

PRODUCT_NAME = "内网接口自动化测试平台"
PLUGIN_NAME = "接口录制助手（浏览器插件）"
FULL_NAME = f"{PRODUCT_NAME} + {PLUGIN_NAME}"


# ---------------------------------------------------------------------------
# 主题配色
# ---------------------------------------------------------------------------

THEMES = {
    "gov": {
        "primary": RGBColor(0x1A, 0x3A, 0x6B),
        "accent": RGBColor(0xC8, 0x2A, 0x2A),
        "gold": RGBColor(0xC9, 0xA0, 0x55),
        "bg_light": RGBColor(0xF4, 0xF6, 0xFA),
        "text": RGBColor(0x22, 0x22, 0x22),
        "subtitle": RGBColor(0x55, 0x55, 0x55),
        "white": RGBColor(0xFF, 0xFF, 0xFF),
    },
    "roi": {
        "primary": RGBColor(0x0D, 0x47, 0xA1),
        "accent": RGBColor(0x00, 0x96, 0x88),
        "gold": RGBColor(0xFF, 0x8F, 0x00),
        "bg_light": RGBColor(0xE8, 0xF4, 0xFD),
        "text": RGBColor(0x1A, 0x1A, 0x2E),
        "subtitle": RGBColor(0x45, 0x5A, 0x64),
        "white": RGBColor(0xFF, 0xFF, 0xFF),
    },
    "ai": {
        "primary": RGBColor(0x2D, 0x1B, 0x69),
        "accent": RGBColor(0x7C, 0x4D, 0xFF),
        "gold": RGBColor(0x00, 0xD4, 0xFF),
        "bg_light": RGBColor(0xF0, 0xEB, 0xFF),
        "text": RGBColor(0x1A, 0x1A, 0x2E),
        "subtitle": RGBColor(0x5C, 0x5C, 0x7A),
        "white": RGBColor(0xFF, 0xFF, 0xFF),
    },
}


def inches(val):
    return Inches(val)


def set_run_font(run, size=24, bold=False, color=None, name="Microsoft YaHei"):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.name = name
    if color:
        run.font.color.rgb = color


def add_bg_rect(slide, theme, full=False):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, inches(13.33), inches(7.5) if full else inches(1.6)
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = theme["primary"]
    shape.line.fill.background()
    if not full:
        return shape
    # 底部装饰条
    bar = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, inches(6.9), inches(13.33), inches(0.6)
    )
    bar.fill.solid()
    bar.fill.fore_color.rgb = theme["accent"]
    bar.line.fill.background()


def add_title_slide(prs, theme, title, subtitle, tagline=""):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg_rect(slide, theme, full=True)
    # 金色装饰线
    line = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, inches(1.2), inches(2.8), inches(2.5), inches(0.06)
    )
    line.fill.solid()
    line.fill.fore_color.rgb = theme["gold"]
    line.line.fill.background()

    box = slide.shapes.add_textbox(inches(1.2), inches(1.4), inches(11), inches(1.5))
    tf = box.text_frame
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    r = p.add_run()
    r.text = title
    set_run_font(r, 40, True, theme["white"])

    box2 = slide.shapes.add_textbox(inches(1.2), inches(3.0), inches(11), inches(1.2))
    tf2 = box2.text_frame
    p2 = tf2.paragraphs[0]
    r2 = p2.add_run()
    r2.text = subtitle
    set_run_font(r2, 26, False, theme["gold"])

    if tagline:
        box3 = slide.shapes.add_textbox(inches(1.2), inches(5.8), inches(11), inches(0.8))
        tf3 = box3.text_frame
        p3 = tf3.paragraphs[0]
        r3 = p3.add_run()
        r3.text = tagline
        set_run_font(r3, 18, False, theme["white"])


def add_section_slide(prs, theme, section_no, section_title):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg_rect(slide, theme, full=True)
    num_box = slide.shapes.add_textbox(inches(1.2), inches(2.2), inches(2), inches(1))
    p = num_box.text_frame.paragraphs[0]
    r = p.add_run()
    r.text = f"0{section_no}" if section_no < 10 else str(section_no)
    set_run_font(r, 72, True, theme["gold"])

    title_box = slide.shapes.add_textbox(inches(1.2), inches(3.5), inches(11), inches(1.5))
    p2 = title_box.text_frame.paragraphs[0]
    r2 = p2.add_run()
    r2.text = section_title
    set_run_font(r2, 36, True, theme["white"])


def add_content_slide(prs, theme, title, bullets, note=""):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    # 顶栏
    add_bg_rect(slide, theme, full=False)
    # 内容区浅底
    bg = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, inches(1.6), inches(13.33), inches(5.9)
    )
    bg.fill.solid()
    bg.fill.fore_color.rgb = theme["bg_light"]
    bg.line.fill.background()

    tbox = slide.shapes.add_textbox(inches(0.8), inches(0.35), inches(12), inches(0.9))
    p = tbox.text_frame.paragraphs[0]
    r = p.add_run()
    r.text = title
    set_run_font(r, 30, True, theme["white"])

    cbox = slide.shapes.add_textbox(inches(1.0), inches(2.0), inches(11.3), inches(5.0))
    tf = cbox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(bullets):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.space_after = Pt(14)
        para.level = 0
        if isinstance(item, tuple):
            text, sub = item
            r_main = para.add_run()
            r_main.text = f"● {text}"
            set_run_font(r_main, 24, True, theme["text"])
            if sub:
                sub_para = tf.add_paragraph()
                sub_para.level = 1
                sub_para.space_after = Pt(10)
                r_sub = sub_para.add_run()
                r_sub.text = f"    {sub}"
                set_run_font(r_sub, 20, False, theme["subtitle"])
        else:
            r_item = para.add_run()
            r_item.text = f"● {item}"
            set_run_font(r_item, 24, False, theme["text"])

    if note:
        slide.notes_slide.notes_text_frame.text = note


def add_quote_slide(prs, theme, quote, author=""):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg_rect(slide, theme, full=True)
    qbox = slide.shapes.add_textbox(inches(1.5), inches(2.5), inches(10.3), inches(2.5))
    tf = qbox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = f"「{quote}」"
    set_run_font(r, 32, True, theme["white"])
    if author:
        abox = slide.shapes.add_textbox(inches(1.5), inches(5.5), inches(10.3), inches(0.8))
        p2 = abox.text_frame.paragraphs[0]
        p2.alignment = PP_ALIGN.CENTER
        r2 = p2.add_run()
        r2.text = author
        set_run_font(r2, 20, False, theme["gold"])


def add_qa_slide(prs, theme, qa_list, page_title="领导关切 · 问答备答"):
    """每页 2 组 Q&A。"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg_rect(slide, theme, full=False)
    bg = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, inches(1.6), inches(13.33), inches(5.9)
    )
    bg.fill.solid()
    bg.fill.fore_color.rgb = theme["bg_light"]
    bg.line.fill.background()

    tbox = slide.shapes.add_textbox(inches(0.8), inches(0.35), inches(12), inches(0.9))
    r = tbox.text_frame.paragraphs[0].add_run()
    r.text = page_title
    set_run_font(r, 28, True, theme["white"])

    y = 1.9
    for q, a in qa_list:
        qbox = slide.shapes.add_textbox(inches(0.9), inches(y), inches(11.5), inches(0.7))
        rq = qbox.text_frame.paragraphs[0].add_run()
        rq.text = f"问：{q}"
        set_run_font(rq, 22, True, theme["accent"])
        y += 0.65
        abox = slide.shapes.add_textbox(inches(0.9), inches(y), inches(11.5), inches(1.3))
        abox.text_frame.word_wrap = True
        ra = abox.text_frame.paragraphs[0].add_run()
        ra.text = f"答：{a}"
        set_run_font(ra, 20, False, theme["text"])
        y += 1.55


def add_closing_slide(prs, theme, lines):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg_rect(slide, theme, full=True)
    y = 2.5
    for line in lines:
        box = slide.shapes.add_textbox(inches(1.5), inches(y), inches(10.3), inches(0.9))
        p = box.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = line
        set_run_font(r, 30, True, theme["white"])
        y += 0.9


# ---------------------------------------------------------------------------
# 通用内容块
# ---------------------------------------------------------------------------

COMMON_PAIN = [
    "测试人员需手动从浏览器抓包、逐字段摘抄接口信息，重复劳动多、易出错",
    "全链路接口参数依赖需人工梳理，上下游参数不匹配导致执行失败频发",
    "测试数据构造依赖人工编写，ID 递增、业务合规数据生成成本高",
    "接口执行失败后，需人工比对请求响应、定位根因，排查效率低",
]

COMMON_ARCH = [
    ("三大交付模块", "后端服务 + 前端可视化平台 + 浏览器录制插件，一体协同"),
    ("后端服务", "Spring Boot 自研执行引擎，链路管理、日志存储、AI 能力、插件对接"),
    ("前端平台", "Vue 3 可视化拖拽编排，执行状态实时展示，普通测试人员零代码上手"),
    ("浏览器插件", "「接口录制助手」录制页面操作，自动捕获接口，一键推送平台"),
]

COMMON_LOOP = [
    "安装插件 → 开启录制 → 操作业务页面",
    "自动捕获接口 + 跨页面持久化存储",
    "人工筛选有效接口 → 自动识别上下游参数依赖",
    "一键推送平台 → 自动生成测试链路 + 节点 + 参数关联",
    "画布微调流程 → AI 生成测试数据 → 触发执行",
    "实时查看节点状态 → 失败一键 AI 分析 → 完整执行日志留存",
]

REGRESSION_FOCUS = [
    ("核心定位", "面向既有功能的回归验证与稳态保障，不是新功能开发验证的主力工具"),
    ("为什么适合回归", "成熟业务流程路径固定，录制一次、反复执行，最适合做版本发布前后的稳态巡检"),
    ("能降低什么", "将大量重复的手工接口回归，转化为「一键执行 + 自动比对」，显著压缩回归工作量"),
    ("不适合什么", "全新业务逻辑首次验证、复杂探索性测试、尚未稳定的频繁变更接口"),
    ("推荐使用节奏", "版本发布前跑全量回归链路；日常每周/每日稳态巡检；重大变更后定点回归"),
]

DEPLOY = [
    ("零额外中间件", "不引入 Redis、MQ、专业流程引擎，单实例即可部署"),
    ("纯内网适配", "全程运行于公司内网，数据不出网，支持离线部署"),
    ("技术栈成熟", "JDK 8 + Spring Boot + MySQL + Vue 3，与现有环境零冲突"),
    ("运维极简", "仅需维护 MySQL 与应用服务，插件离线更新"),
    ("落地周期短", "Docker 一键拉起数据库，应用打包部署，测试人员装插件即可用"),
]

AI_FEATURES = [
    ("AI 全链路测试数据生成", "基于已有链路模板，智能生成合规测试数据，支持 ID 自增/自定义策略"),
    ("AI 执行失败智能分析", "节点失败时自动分析根因，给出排查步骤和修复建议"),
    ("安全可控", "所有 AI 能力基于已有模板，无模板不凭空生成；对接内网大模型，数据不出网"),
    ("智能降级", "大模型未配置时，自动切换规则分析，保障基本可用"),
]

QA_ALL = [
    (
        "这个平台是干什么的？能解决什么问题？",
        "这是一套面向纯内网环境的接口自动化测试平台。核心解决测试人员「手工摘抄接口、人工梳理依赖、重复回归、失败难排查」四大痛点，把成熟业务的接口回归变成可录制、可复用、可一键执行的标准化能力。",
    ),
    (
        "跟市面上 Postman、JMeter 有什么区别？",
        "市面工具偏「单接口调试」，我们做的是「全链路闭环」：浏览器录制 → 自动识别参数依赖 → 可视化编排 → 批量执行 → 实时状态 → AI 排障。更重要的是完全适配纯内网、零中间件，测试人员不需要写代码。",
    ),
    (
        "为什么更适合回归，而不是测新功能？",
        "回归场景的业务路径已经跑通、接口相对稳定，录制一次就能反复执行。新功能往往接口频繁变动、业务规则未定型，维护成本反而高。所以我们明确定位：做「稳态保障」和「回归减负」，而非新需求探索测试的主力。",
    ),
    (
        "能降低多少测试工作量？",
        "以一条 10 个接口的业务链路为例：手工回归每次约 2-3 小时（摘抄+执行+比对），平台化后首次录制约 30 分钟，之后每次一键执行约 3-5 分钟。长期看，回归人力可压缩 70%-90%，测试人员精力转向更有价值的场景设计。",
    ),
    (
        "测试人员好上手吗？需要会编程吗？",
        "不需要编程。测试人员只需：装插件 → 像平时一样操作业务页面 → 点「推送平台」→ 在画布上微调 → 点「执行」。全程可视化，JSON 编辑有格式化工具，普通测试人员半天即可独立操作。",
    ),
    (
        "数据安全怎么保障？会不会出内网？",
        "平台全程运行于公司内网，所有测试数据、接口信息、执行日志存储在内网服务器。AI 能力对接内网部署的大模型服务，不出网。浏览器插件仅捕获指定业务域名的请求，权限范围可控。",
    ),
    (
        "部署复杂吗？需要买很多服务器吗？",
        "不复杂。单实例即可运行，仅需一台应用服务器 + MySQL 数据库，不需要 Redis、消息队列等额外中间件。支持 Docker 部署，运维成本极低。",
    ),
    (
        "AI 是不是噱头？实际价值在哪？",
        "我们只做两个高价值 AI 场景，不做花架子：一是基于链路模板自动生成合规测试数据，解决 ID 递增和数据构造痛点；二是执行失败时一键 AI 分析根因，把原来 30 分钟的排查缩短到 1 分钟。且 AI 未配置时有规则降级，不影响基本使用。",
    ),
    (
        "自动识别参数依赖准确吗？",
        "对字段名一致的参数，识别准确率很高。语义相近但字段名不一致的，可能存在少量漏识别，平台会在画布上高亮标记已识别的依赖关系，测试人员可一键校验和手动补充。这是可控的小偏差，不影响整体落地。",
    ),
    (
        "版本升级后接口变了怎么办？",
        "重新录制或追加节点即可。平台支持「追加至现有链路」，不必从零开始。对于频繁变更的新功能接口，建议仍以手工验证为主，等接口稳定后再纳入自动化回归库。",
    ),
    (
        "能不能定时自动跑？",
        "当前版本以手动触发执行为主，已规划定时回归测试作为下一期能力。现阶段建议纳入发布流程：版本发布前由测试负责人统一触发全量回归。",
    ),
    (
        "出了问题谁负责？会不会误报？",
        "自动化回归是「辅助判断」而非「替代人工」。它的价值在于快速覆盖大量重复路径、第一时间发现接口异常。最终发布决策仍由测试负责人把关，平台提供完整执行日志和 AI 分析辅助定位。",
    ),
    (
        "投入产出比怎么样？",
        "建设成本：一套轻量化平台，无额外中间件采购。收益：每条成熟业务链路录制一次、长期复用，回归人力大幅压缩，故障发现前置到发布前。按内部评估，可落地性评分 97/100，属于「小投入、大收益、快见效」的信息化提质增效项目。",
    ),
    (
        "未来还能做什么？",
        "已规划方向包括：定时回归任务、测试报告自动导出、条件分支/循环编排、断点重跑、用例版本管理。随着内网大模型能力增强，还可扩展智能用例推荐、变更影响分析等 AI 场景。",
    ),
    (
        "现在就能用吗？成熟度如何？",
        "核心闭环已完整实现：录制、导入、编排、执行、日志、WebSocket 实时推送、AI 失败分析均已开发完成。建议先选 1-2 条最成熟、最高频的回归链路做试点，验证效果后逐步推广。",
    ),
]


def build_slides_gov(prs, theme):
    """方案一：政务稳重型。"""
    add_title_slide(
        prs, theme,
        PRODUCT_NAME,
        "信息化提质增效 · 接口回归稳态保障方案",
        "汇报单位：________　　汇报人：________　　日期：________",
    )
    add_section_slide(prs, theme, 1, "建设背景与痛点")
    add_content_slide(prs, theme, "为什么需要这个平台？", [
        "业务系统持续迭代，接口数量快速增长，手工测试已难以支撑稳态保障要求",
        "测试力量有限，大量精力消耗在重复回归，难以投入到更有价值的质量工作中",
        "信息化建设不仅要「建得好」，更要「管得住、测得稳」",
    ], "从领导视角：强调质量保障是数字化建设的底座。")
    add_content_slide(prs, theme, "当前测试工作四大痛点", COMMON_PAIN)
    add_quote_slide(
        prs, theme,
        "成熟业务的稳态保障，不应依赖人海战术",
        "—— 回归自动化是信息化提质增效的关键抓手",
    )

    add_section_slide(prs, theme, 2, "平台定位与适用场景")
    add_content_slide(prs, theme, "平台一句话定位", [
        f"「{FULL_NAME}」",
        "让测试人员像操作业务页面一样，完成接口回归用例的建设与执行",
        "核心使命：降低回归工作量，保障系统稳态运行",
    ])
    add_content_slide(prs, theme, "明确适用场景（领导重点关注）", REGRESSION_FOCUS)
    add_content_slide(prs, theme, "场景边界：什么不做", [
        "不做新功能首次验证的主力工具（接口未稳定、规则未定型）",
        "不做复杂探索性测试、性能压测（本期聚焦接口功能回归）",
        "不做大规模分布式集群（本期单实例轻量化落地）",
        "定位清晰，避免「万能工具」预期，确保落地口碑",
    ])

    add_section_slide(prs, theme, 3, "核心能力与架构")
    add_content_slide(prs, theme, "三大模块协同架构", COMMON_ARCH)
    add_content_slide(prs, theme, "完整业务闭环", COMMON_LOOP)
    add_content_slide(prs, theme, "自研执行引擎：稳态巡检的「发动机」", [
        "支持全串行 + 分组并行两种执行模式",
        "自动变量传递：上下游接口参数自动衔接，无需人工拼接",
        "断言校验 + 完整日志：每次执行留痕，可追溯、可审计",
        "WebSocket 实时推送：执行过程全程可视，领导可感知「在干活」",
    ])
    add_content_slide(prs, theme, "浏览器插件：零门槛的「录制器」", [
        "测试人员正常操作业务页面，插件自动捕获全部接口请求",
        "跨页面跳转不丢数据，支持筛选、搜索、详情查看",
        "一键推送至平台，自动识别参数依赖，生成完整测试链路",
        "无需编程、无需手工摘抄，半天即可上手",
    ])

    add_section_slide(prs, theme, 4, "AI 赋能与差异化价值")
    add_content_slide(prs, theme, "精准 AI 赋能：只做两件事", AI_FEATURES)
    add_content_slide(prs, theme, "给测试人员带来的直接好处", [
        ("告别手工摘抄", "录制替代抓包复制，建用例效率提升 5-10 倍"),
        ("告别人工拼参数", "自动识别上下游依赖，全链路参数自动传递"),
        ("告别重复回归", "一键执行成熟链路，单次回归从小时级降到分钟级"),
        ("告别盲目排查", "失败节点一键 AI 分析，快速定位根因"),
    ])

    add_section_slide(prs, theme, 5, "落地路径与保障")
    add_content_slide(prs, theme, "部署方案：极简、可控、不出内网", DEPLOY)
    add_content_slide(prs, theme, "三阶段落地建议", [
        ("第一阶段（1-2 周）", "选 1-2 条最高频回归链路试点，完成录制→执行→验证"),
        ("第二阶段（1 个月）", "推广至各业务模块核心链路，建立「回归链路库」"),
        ("第三阶段（持续）", "纳入版本发布流程，形成「发布前必跑」稳态机制"),
    ])
    add_content_slide(prs, theme, "可落地性评估", [
        "业务闭环完整性：24/25 分",
        "技术可行性：25/25 分",
        "环境适配性：20/20 分",
        "运维与维护成本：14/15 分",
        "用户体验与易用性：14/15 分",
        "综合评分：97/100 —— 高度可落地，无致命缺陷",
    ])

    add_section_slide(prs, theme, 6, "成效展望")
    add_content_slide(prs, theme, "当前价值（已具备）", [
        "完整闭环已开发完成，可立即试点",
        "回归人力预计压缩 70%-90%（成熟链路）",
        "故障发现前置到发布前，降低线上风险",
        "执行过程全留痕，满足审计追溯要求",
    ])
    add_content_slide(prs, theme, "未来价值（已规划）", [
        "定时回归任务：无人值守的稳态巡检",
        "测试报告自动导出：一键生成汇报材料",
        "AI 变更影响分析：智能推荐需回归的链路",
        "用例版本管理：回归资产持续积累、可传承",
    ])
    add_quote_slide(
        prs, theme,
        "小投入、快见效、可持续",
        "—— 让信息化建设的成果「测得稳、跑得通」",
    )

    add_content_slide(prs, theme, "可视化编排：测试人员的「作战沙盘」", [
        "LogicFlow 拖拽画布，左-中-右三栏标准布局",
        "节点详情支持 JSON 格式化编辑、一键复制",
        "执行时节点卡片实时变色：绿成功、红失败、蓝运行中、灰跳过",
        "点击节点查看完整请求/响应，失败节点一键 AI 分析",
    ])
    add_content_slide(prs, theme, "执行日志：全过程可追溯", [
        "执行主日志：记录链路级状态、总耗时、全局错误信息",
        "节点明细日志：完整复现每次请求的请求头、请求体、响应码、响应体",
        "支持按链路、状态、时间范围分页查询",
        "满足审计追溯要求，「谁在什么时候测了什么」一目了然",
    ])
    add_content_slide(prs, theme, "风险可控：诚实面对不足", [
        ("参数依赖识别", "字段名不一致时可能漏识别 → 画布高亮标记，人工一键补充"),
        ("大模型造数", "格式可能偏差 → 人工确认环节，不强制自动落库"),
        ("插件录制", "极端跳转场景可能丢请求 → 支持二次录制追加"),
        ("总体评估", "均为低风险、有规避方案，不影响 97 分可落地性判定"),
    ])
    add_content_slide(prs, theme, "与现有工作的衔接", [
        "不替代测试人员的业务判断，而是接管重复劳动",
        "新功能仍由测试人员手工验证，成熟后纳入回归库",
        "发布决策权仍在测试负责人，平台提供数据和日志支撑",
        "与现有项目管理、版本发布流程自然衔接，无额外流程负担",
    ])

    add_section_slide(prs, theme, 7, "领导关切 · 问答备答")
    for i in range(0, len(QA_ALL), 2):
        add_qa_slide(prs, theme, QA_ALL[i : i + 2])

    add_closing_slide(prs, theme, [
        "感谢各位领导指导",
        "恳请支持试点推广",
        PRODUCT_NAME,
    ])


def build_slides_roi(prs, theme):
    """方案二：价值成效型。"""
    add_title_slide(
        prs, theme,
        "接口回归自动化",
        "测试提效与稳态保障价值汇报",
        "用数据说话 · 用结果证明 · 用闭环落地",
    )
    add_section_slide(prs, theme, 1, "痛点量化：钱花在哪了")
    add_content_slide(prs, theme, "测试人力的「隐形浪费」", [
        ("手工摘抄接口", "每条链路平均 1-2 小时，10 条链路 = 10-20 人天/次"),
        ("人工回归执行", "每条链路每次 2-3 小时，月发 4 版 = 80-120 人时/月"),
        ("失败排查定位", "单次故障平均 30-60 分钟，占测试总工时 20%+"),
        ("新人培养成本", "熟悉接口依赖需 1-2 周，知识难以沉淀复用"),
    ])
    add_content_slide(prs, theme, "如果不改变，会怎样？", [
        "版本发布周期被回归测试拖累",
        "测试人员疲于重复劳动，高质量测试投入不足",
        "接口故障发现滞后，线上风险持续存在",
        "信息化建设「建得好」但「测不稳」",
    ])

    add_section_slide(prs, theme, 2, "解决方案总览")
    add_content_slide(prs, theme, f"{FULL_NAME}", [
        "一套平台 + 一个插件 = 完整回归自动化闭环",
        "测试人员零代码，像操作业务页面一样建设用例",
        "纯内网部署，零额外中间件，单实例即可运行",
    ])
    add_content_slide(prs, theme, "六步闭环，步步省心", COMMON_LOOP)

    add_section_slide(prs, theme, 3, "前后对比：效果一目了然")
    add_content_slide(prs, theme, "建用例：从「小时级」到「分钟级」", [
        ("以前", "抓包 → 手工摘抄 URL/Header/Body → 人工梳理依赖 → 逐个配置"),
        ("现在", "操作页面 → 插件自动捕获 → 一键推送 → 平台自动生成链路"),
        ("效率变化", "首次建设效率提升 5-10 倍，后续维护成本趋近于零"),
    ])
    add_content_slide(prs, theme, "跑回归：从「人海战术」到「一键执行」", [
        ("以前", "每次发版重复手工调接口，10 节点链路约 2-3 小时"),
        ("现在", "一键触发，3-5 分钟完成，WebSocket 实时看进度"),
        ("效率变化", "回归人力压缩 70%-90%，测试人员可并行多条链路"),
    ])
    add_content_slide(prs, theme, "排故障：从「盲人摸象」到「一键诊断」", [
        ("以前", "人工比对请求响应，逐字段排查，平均 30-60 分钟"),
        ("现在", "失败节点一键 AI 分析，秒级给出根因+排查步骤+修复建议"),
        ("效率变化", "故障定位效率提升 10 倍以上"),
    ])

    add_section_slide(prs, theme, 4, "核心能力拆解")
    add_content_slide(prs, theme, "能力一：录制式零配置建用例", [
        "浏览器插件「接口录制助手」自动捕获页面全部接口",
        "自动识别上下游参数依赖，生成变量提取与占位符引用",
        "跨页面持久化存储，跳转不丢数据",
    ])
    add_content_slide(prs, theme, "能力二：可视化低门槛编排", [
        "拖拽式画布调整流程，无需编码",
        "JSON 格式化编辑、一键复制，降低配置门槛",
        "支持链路复制，快速生成变体用例",
    ])
    add_content_slide(prs, theme, "能力三：自研执行引擎", [
        "串行 + 分组并行，覆盖 90%+ 接口测试场景",
        "变量自动传递、断言自动校验、异常自动中断",
        "完整执行日志落库，支持审计追溯",
    ])
    add_content_slide(prs, theme, "能力四：AI 双引擎", AI_FEATURES)

    add_section_slide(prs, theme, 5, "场景定位：回归与稳态")
    add_content_slide(prs, theme, "我们的战场：成熟业务的「稳态防线」", REGRESSION_FOCUS)
    add_content_slide(prs, theme, "推荐使用矩阵", [
        ("版本发布前", "全量回归核心链路，确保不发版「带病上线」"),
        ("日常巡检", "每周/每日定时执行高频链路，早发现早处置"),
        ("重大变更后", "对受影响模块定点回归，精准验证"),
        ("新功能开发期", "仍以手工验证为主，待接口稳定后纳入回归库"),
    ])

    add_section_slide(prs, theme, 6, "落地保障")
    add_content_slide(prs, theme, "技术架构：极简可运维", COMMON_ARCH)
    add_content_slide(prs, theme, "部署清单", DEPLOY)
    add_content_slide(prs, theme, "试点推广三步走", [
        ("选", "选 1-2 条最高频、最成熟的回归链路"),
        ("跑", "完成录制→编排→执行→验证，用数据证明效果"),
        ("扩", "推广至各模块，建立回归链路库，纳入发布流程"),
    ])

    add_section_slide(prs, theme, 7, "价值总结")
    add_content_slide(prs, theme, "三维价值", [
        ("效率价值", "回归人力压缩 70%-90%，释放测试产能"),
        ("质量价值", "故障发现前置，降低线上事故风险"),
        ("资产价值", "回归用例可沉淀、可复用、可传承，越用越强"),
    ])
    add_content_slide(prs, theme, "可落地性：97/100", [
        "全链路闭环无断点，核心功能已开发完成",
        "纯内网零中间件，与现有环境完全兼容",
        "现存不足均有明确规避方案，无不可解决风险",
    ])

    add_content_slide(prs, theme, "技术参数一览（领导快速查阅）", [
        "后端：JDK 8 + Spring Boot 2.7 + MySQL + LangChain4j",
        "前端：Vue 3 + Vite + Element Plus + LogicFlow",
        "插件：Chrome/Edge Manifest V3，纯内网运行",
        "部署：单实例 + MySQL，支持 Docker，无需 Redis/MQ",
    ])
    add_content_slide(prs, theme, "一条链路的完整生命周期", [
        "创建：插件录制推送 / 手工新建 / 复制已有链路",
        "配置：画布编排 + AI 造数 + 人工确认",
        "执行：一键触发 → 异步执行 → WebSocket 实时推送",
        "复盘：查看日志 → 失败 AI 分析 → 优化链路 → 再次执行",
        "沉淀：成熟链路纳入回归库，长期复用",
    ])
    add_content_slide(prs, theme, "预期成效数据（试点后可验证）", [
        "建用例效率：提升 5-10 倍（录制 vs 手工摘抄）",
        "回归执行效率：提升 20-40 倍（一键 vs 手工调接口）",
        "故障定位效率：提升 10 倍以上（AI 分析 vs 人工比对）",
        "回归人力占比：从 60%-70% 降至 10%-20%",
    ])

    add_section_slide(prs, theme, 8, "问答备答")
    for i in range(0, len(QA_ALL), 2):
        add_qa_slide(prs, theme, QA_ALL[i : i + 2], "常见问题 · 应答参考")

    add_closing_slide(prs, theme, [
        "用自动化守住稳态",
        "用数据证明价值",
        "恳请领导支持试点",
    ])


def build_slides_ai(prs, theme):
    """方案三：AI 赋能未来型。"""
    add_title_slide(
        prs, theme,
        "AI + 自动化测试",
        "内网接口回归智能化平台",
        "当前能跑 · 未来可期 · 安全可控",
    )
    add_section_slide(prs, theme, 1, "时代背景")
    add_content_slide(prs, theme, "AI 时代，测试工作也要升级", [
        "国家大力推进人工智能 + 各行业深度融合",
        "测试工作不应停留在「人海战术」，而应拥抱智能化工具",
        "关键问题：AI 不是噱头，要找到真正有价值的落地场景",
    ])
    add_content_slide(prs, theme, "我们的回答：精准 AI，不做花架子", [
        "只做 2 个高价值 AI 能力，均基于已有链路模板",
        "无模板不凭空生成，确保可控、可审计、可落地",
        "AI 未配置时自动降级为规则分析，基本能力不受影响",
    ])

    add_section_slide(prs, theme, 2, "产品全景")
    add_content_slide(prs, theme, f"{FULL_NAME}", COMMON_ARCH)
    add_content_slide(prs, theme, "一条链路，走完闭环", COMMON_LOOP)

    add_section_slide(prs, theme, 3, "AI 能力深度解读")
    add_content_slide(prs, theme, "AI 能力一：全链路智能造数", [
        "输入：数据库中已有的链路节点模板（URL、字段结构、业务含义）",
        "处理：大模型按业务规则生成合规测试数据",
        "输出：按节点维度返回请求头、请求体，支持人工确认后保存",
        "ID 策略：支持自增模式（基于历史最大 ID）和自定义起始值",
    ])
    add_content_slide(prs, theme, "AI 能力二：失败智能诊断", [
        "输入：完整请求信息 + 响应状态码 + 响应体 + 错误堆栈",
        "分析维度：参数错误、字段缺失、权限不足、业务校验失败、服务异常等",
        "输出：根因定位 + 排查步骤 + 修复方案（结构化三段式）",
        "降级策略：大模型不可用时，按 HTTP 状态码返回规则分析模板",
    ])
    add_content_slide(prs, theme, "AI 安全边界", [
        "所有 AI 调用走内网大模型服务，数据不出网",
        "AI 只基于已有模板工作，不凭空编造接口或业务逻辑",
        "生成结果需人工确认后才落库，人机协同而非全自动",
        "完整日志留痕，AI 分析结果可追溯",
    ])

    add_section_slide(prs, theme, 4, "回归稳态：AI 的最佳战场")
    add_content_slide(prs, theme, "为什么 AI 回归比 AI 新功能测试更靠谱？", [
        "回归场景：业务路径固定、接口结构稳定 → AI 模板可复用",
        "新功能场景：接口频繁变动、规则未定型 → AI 维护成本反而高",
        "结论：先把 AI 用在「确定性高」的回归场景，见效快、风险低",
    ])
    add_content_slide(prs, theme, "场景定位", REGRESSION_FOCUS)

    add_section_slide(prs, theme, 5, "测试人员体感")
    add_content_slide(prs, theme, "以前 vs 现在", [
        ("建用例", "抓包摘抄 2 小时 → 录制推送 30 分钟"),
        ("造数据", "手工编 JSON 1 小时 → AI 一键生成 1 分钟"),
        ("跑回归", "手工调接口 3 小时 → 一键执行 5 分钟"),
        ("查故障", "逐字段比对 30 分钟 → AI 分析 1 分钟"),
    ])
    add_content_slide(prs, theme, "测试人员只需要会三件事", [
        "会操作业务页面（本来就会）",
        "会点插件上的「推送平台」按钮",
        "会在画布上确认流程、点「执行」",
    ])

    add_section_slide(prs, theme, 6, "技术底座")
    add_content_slide(prs, theme, "自研执行引擎", [
        "不依赖专业流程引擎，自研覆盖 90%+ 场景",
        "串行 + 分组并行，变量自动传递",
        "WebSocket 实时推送，执行过程全透明",
    ])
    add_content_slide(prs, theme, "极简部署", DEPLOY)

    add_section_slide(prs, theme, 7, "未来蓝图")
    add_content_slide(prs, theme, "近期（已具备）", [
        "录制 → 编排 → AI 造数 → 执行 → AI 排障 全闭环",
        "可立即选试点链路验证效果",
    ])
    add_content_slide(prs, theme, "中期（已规划）", [
        "定时回归任务：无人值守稳态巡检",
        "测试报告自动导出：一键生成领导汇报材料",
        "条件分支/循环编排：覆盖更复杂业务场景",
    ])
    add_content_slide(prs, theme, "远期（AI 深度融合）", [
        "变更影响分析：代码变更后 AI 推荐需回归的链路",
        "智能用例推荐：基于历史执行数据优化回归策略",
        "自然语言建用例：描述业务流程，AI 自动生成链路",
        "质量态势大屏：领导一屏掌握系统健康度",
    ])
    add_quote_slide(
        prs, theme,
        "今天种下的回归自动化，是明天智能化运维的基石",
    )

    add_content_slide(prs, theme, "WebSocket 实时推送：执行过程「看得见」", [
        "前端进入执行页自动建立 WebSocket 连接",
        "节点开始、完成、链路结束时实时推送状态",
        "推送内容：节点编码、状态、耗时、响应码、简要错误",
        "领导可随时查看执行大屏，感知平台「在干活」",
    ])
    add_content_slide(prs, theme, "插件能力清单", [
        "页面操作录制，自动捕获全部网络请求",
        "跨页面持久化存储，跳转不丢数据",
        "接口筛选、搜索、详情查看、勾选推送",
        "支持导出 JSON 文件，支持追加至已有链路",
        "纯内网运行，无外网请求，权限范围可控",
    ])
    add_content_slide(prs, theme, "AI 与自动化的协同关系", [
        "自动化解决「重复执行」问题 —— 机器干机器的活",
        "AI 解决「数据构造」和「故障诊断」问题 —— 智能干智能的活",
        "人工解决「业务判断」和「最终决策」问题 —— 人干人的活",
        "三者协同，而非互相替代，这才是 AI 时代的正确打开方式",
    ])

    add_section_slide(prs, theme, 8, "落地与问答")
    add_content_slide(prs, theme, "试点建议", [
        "选 1-2 条最成熟链路，2 周内出效果数据",
        "用「前后对比」说话，不靠 PPT 靠结果",
        "验证通过后纳入发布流程，形成长效机制",
    ])
    for i in range(0, len(QA_ALL), 2):
        add_qa_slide(prs, theme, QA_ALL[i : i + 2])

    add_closing_slide(prs, theme, [
        "AI 赋能测试，稳态保障升级",
        "当前能跑，未来可期",
        "恳请领导审阅支持",
    ])


def generate_ppt(theme_key, filename, builder):
    theme = THEMES[theme_key]
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    builder(prs, theme)
    out = OUTPUT_DIR / filename
    prs.save(str(out))
    return out, len(prs.slides)


def main():
    configs = [
        ("gov", "方案一_政务稳重型_内网接口自动化测试平台.pptx", build_slides_gov),
        ("roi", "方案二_价值成效型_测试提效与稳态保障.pptx", build_slides_roi),
        ("ai", "方案三_AI赋能未来型_智能化回归平台.pptx", build_slides_ai),
    ]
    for key, fname, builder in configs:
        path, count = generate_ppt(key, fname, builder)
        print(f"已生成: {path} ({count} 页)")


if __name__ == "__main__":
    main()
