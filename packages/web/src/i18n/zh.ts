const zh = {
  // Common
  'app.name': 'Bed-Vibe',
  'common.cancel': '取消',
  'common.confirm': '确认',
  'common.save': '保存',
  'common.delete': '删除',
  'common.search': '搜索',
  'common.loading': '加载中...',
  'common.copy': '复制',
  'common.copied': '已复制',

  // Auth
  'auth.login': '登录',
  'auth.register': '注册',
  'auth.username': '用户名',
  'auth.password': '密码',
  'auth.displayName': '显示名称',
  'auth.logout': '退出登录',
  'auth.loginFailed': '登录失败',

  // Setup
  'setup.title': '初始化设置',
  'setup.desc': '创建管理员账户以开始使用',
  'setup.create': '创建账户',

  // Sessions
  'sessions.title': '会话',
  'sessions.empty': '暂无会话',
  'sessions.search': '搜索会话...',
  'sessions.new': '新建',
  'sessions.all': '全部',
  'sessions.active': '活跃',
  'sessions.inactive': '空闲',
  'sessions.archived': '归档',
  'sessions.thinking': '思考中',
  'sessions.remote': '远程',
  'sessions.copyResume': '复制恢复命令',

  // Chat
  'chat.unnamed': '未命名会话',
  'chat.send': '发送',
  'chat.placeholder': '输入消息...',
  'chat.loadOlder': '加载更早消息',
  'chat.interrupt': '中断',
  'chat.tokens': '令牌',

  // New Session
  'newSession.title': '新建会话',
  'newSession.machine': '机器',
  'newSession.cwd': '工作目录',
  'newSession.model': '模型（可选）',
  'newSession.prompt': '初始提示（可选）',
  'newSession.promptPlaceholder': '让 Claude 做什么？',
  'newSession.create': '创建',
  'newSession.spawning': '创建中...',
  'newSession.pathValid': '路径有效',
  'newSession.pathInvalid': '路径无效',

  // Machines
  'machines.title': '机器管理',
  'machines.add': '添加机器',
  'machines.pair': '配对机器',
  'machines.name': '机器名称',
  'machines.online': '在线',
  'machines.offline': '离线',
  'machines.pairCode': '配对码',
  'machines.pairCodePlaceholder': '输入 CLI 显示的配对码',
  'machines.pairDesc': '在终端运行 bv init <服务器地址> 获取配对码',
  'machines.token': '机器令牌',
  'machines.tokenHint': '请妥善保存，仅显示一次',
  'machines.delete': '删除机器',
  'machines.deleteConfirm': '确定要删除这台机器吗？关联的会话数据不会被删除。',
  'machines.lastSeen': '最后在线',

  // Settings
  'settings.title': '设置',
  'settings.language': '语言',
  'settings.theme': '主题',
  'settings.themeDark': '深色',
  'settings.themeLight': '浅色',
  'settings.themeSystem': '跟随系统',
  'settings.push': '推送通知',
  'settings.pushEnable': '启用浏览器推送',
  'settings.pushNotSupported': '当前浏览器不支持推送通知',

  // Admin
  'admin.title': '管理面板',
  'admin.stats': '系统统计',
  'admin.totalUsers': '总用户数',
  'admin.totalSessions': '总会话数',
  'admin.activeSessions': '活跃会话',
  'admin.totalMessages': '总消息数',
  'admin.machinesOnline': '在线机器',
  'admin.machinesTotal': '机器总数',

  // Permission
  'perm.title': '权限请求',
  'perm.approve': '允许',
  'perm.deny': '拒绝',

  // Message types
  'msg.thinking': '思考中',
  'msg.result': '结果',
  'msg.error': '错误',
} as const

export default zh
