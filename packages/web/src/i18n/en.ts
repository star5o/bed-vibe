const en = {
  // Common
  'app.name': 'Bed-Vibe',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.search': 'Search',
  'common.loading': 'Loading...',
  'common.copy': 'Copy',
  'common.copied': 'Copied',

  // Auth
  'auth.login': 'Login',
  'auth.register': 'Register',
  'auth.username': 'Username',
  'auth.password': 'Password',
  'auth.currentPassword': 'Current password',
  'auth.newPassword': 'New password (6+ chars)',
  'auth.changePassword': 'Change Password',
  'auth.passwordChanged': 'Password changed',
  'auth.displayName': 'Display Name',
  'auth.logout': 'Logout',
  'auth.loginFailed': 'Login failed',
  'auth.tooManyAttempts': 'Too many attempts, try again later',

  // Setup
  'setup.title': 'Initial Setup',
  'setup.desc': 'Create an admin account to get started',
  'setup.create': 'Create Account',

  // Sessions
  'sessions.title': 'Sessions',
  'sessions.empty': 'No sessions yet',
  'sessions.search': 'Search sessions...',
  'sessions.new': 'New',
  'sessions.all': 'All',
  'sessions.active': 'Active',
  'sessions.inactive': 'Idle',
  'sessions.archived': 'Archived',
  'sessions.thinking': 'thinking',
  'sessions.remote': 'remote',
  'sessions.copyResume': 'Copy resume command',

  // Chat
  'chat.unnamed': 'Unnamed session',
  'chat.send': 'Send',
  'chat.placeholder': 'Send a message...',
  'chat.loadOlder': 'Load older',
  'chat.interrupt': 'Interrupt',
  'chat.tokens': 'tokens',

  // New Session
  'newSession.title': 'New Session',
  'newSession.machine': 'Machine',
  'newSession.cwd': 'Working Directory',
  'newSession.model': 'Model (optional)',
  'newSession.prompt': 'Initial Prompt (optional)',
  'newSession.promptPlaceholder': 'What should Claude do?',
  'newSession.create': 'Create',
  'newSession.spawning': 'Spawning...',
  'newSession.pathValid': 'Path valid',
  'newSession.pathInvalid': 'Path invalid',

  // Machines
  'machines.title': 'Machines',
  'machines.add': 'Add Machine',
  'machines.pair': 'Pair Machine',
  'machines.name': 'Machine Name',
  'machines.online': 'Online',
  'machines.offline': 'Offline',
  'machines.pairCode': 'Pairing Code',
  'machines.pairCodePlaceholder': 'Enter the code shown in CLI',
  'machines.pairDesc': 'Run bv init <server-url> in terminal to get a pairing code',
  'machines.token': 'Machine Token',
  'machines.tokenHint': 'Save this token — it will only be shown once',
  'machines.delete': 'Delete Machine',
  'machines.deleteConfirm': 'Are you sure you want to delete this machine? Session data will not be removed.',
  'machines.lastSeen': 'Last seen',

  // Settings
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.themeDark': 'Dark',
  'settings.themeLight': 'Light',
  'settings.themeSystem': 'System',
  'settings.push': 'Push Notifications',
  'settings.pushEnable': 'Enable browser push',
  'settings.pushNotSupported': 'Push notifications not supported in this browser',

  // Admin
  'admin.title': 'Admin Panel',
  'admin.stats': 'System Stats',
  'admin.totalUsers': 'Total Users',
  'admin.totalSessions': 'Total Sessions',
  'admin.activeSessions': 'Active Sessions',
  'admin.totalMessages': 'Total Messages',
  'admin.machinesOnline': 'Machines Online',
  'admin.machinesTotal': 'Total Machines',

  // Permission
  'perm.title': 'Permission Request',
  'perm.approve': 'Approve',
  'perm.deny': 'Deny',

  // Message types
  'msg.thinking': 'Thinking',
  'msg.result': 'Result',
  'msg.error': 'Error',
} as const

export default en
