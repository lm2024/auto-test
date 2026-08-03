/**
 * 登录页左侧「图解轮播」配置
 * ───────────────────────────────────────────────
 * 这里控制登录页左边展示的每一张图（标题 / 描述 / 标签）。
 * 目标用户是测试人员，所以图要让他们一眼看懂：
 *   「这个系统是什么、能做什么、我该怎么用」。
 *
 * 【如何替换 / 增删图片】
 * 1. 把你的图片放到  public/login-banners/  目录下
 *    （支持 svg / png / jpg / webp，推荐使用 svg 更清晰）。
 * 2. 在下面的数组里增删一项即可：
 *      {
 *        src:   '/login-banners/你的图.svg',  // 对应 public/login-banners/ 下的路径
 *        tag:   '标签',                         // 小角标，如「核心能力」
 *        title: '标题',
 *        desc:  '一句话描述'
 *      }
 * 3. 保存后页面自动热更新，无需改其他代码。
 *
 * 注意：src 以 '/' 开头表示项目根（public 目录），
 *      不要写成相对路径。
 */

const loginBanners = [
  {
    src: '/login-banners/banner-pipeline.svg',
    tag: '核心能力',
    title: '自动化测试流水线',
    desc: '从用例编写、调度执行、断言校验到报告分析，一键跑通质量闭环。'
  },
  {
    src: '/login-banners/banner-flow.svg',
    tag: '可视化',
    title: '拖拽式流程编排',
    desc: '像搭积木一样把 HTTP、数据库、断言等节点组合成测试链路。'
  },
  {
    src: '/login-banners/banner-data.svg',
    tag: '数据驱动',
    title: '一份数据，多组场景',
    desc: '参数化 + 数据文件，批量执行，让边界与异常场景覆盖更全面。'
  },
  {
    src: '/login-banners/banner-ai.svg',
    tag: 'AI 加持',
    title: 'AI 智能生成用例',
    desc: '用自然语言描述需求，AI 自动生成测试用例与断言，效率提升 10 倍。'
  },
  {
    src: '/login-banners/banner-start.svg',
    tag: '新手引导',
    title: '三步即可上手',
    desc: '创建链路 → 编排节点 → 一键执行，零代码也能做接口自动化。'
  }
]

export default loginBanners
