/**
 * All affiliate-facing UI text. Chinese strings are Simplified Chinese for a
 * Singapore audience — have a native speaker review before launch. The admin
 * console is English-only and does not use this file.
 *
 * Placeholders: {code}, {link}, {version}.
 */

const en = {
  localeName: "English",
  common: {
    signOut: "Sign out",
    language: "Language",
  },
  login: {
    title: "EcoStorage Affiliates",
    subtitle: "Sign in to your affiliate account.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in...",
    error: "Incorrect email or password.",
  },
  dashboard: {
    greeting: "Hi {name}",
    subtitle: "Your referrals and commission.",
    codeHeading: "Your referral code",
    active: "Active",
    inactive: "Inactive",
    noCode: "No code yet.",
    referralsHeading: "Referrals",
    noReferrals: "No referrals yet. Share your link to get started.",
    columns: {
      name: "Name",
      mobile: "Mobile",
      email: "Email",
      submitted: "Submitted",
      status: "Status",
      commission: "Commission",
    },
    signupStatus: {
      lead: "Lead",
      contacted: "Contacted",
      customer: "Customer",
      moved_out: "Moved out",
      lost: "Lost",
    },
    commissionStatus: {
      pending: "Pending",
      qualified: "Qualified",
      paid: "Paid",
      forfeited: "Forfeited",
      ineligible: "Not eligible",
    },
  },
  welcome: {
    step: "Step {n} of 3",
    languageTitle: "Welcome to EcoStorage Affiliates",
    languagePrompt: "Which language do you prefer?",
    continue: "Continue",
    back: "Back",
    termsTitle: "Affiliate Agreement",
    termsVersion: "Version {version}",
    translationNotice: "",
    termsUnavailable:
      "The affiliate agreement isn't available yet. We'll email you as soon as your account is ready to activate.",
    agree:
      "I have read and agree to the EcoStorage Affiliate Agreement (version {version}).",
    agreeGoverning: "",
    accept: "Accept and activate my code",
    accepting: "Activating...",
    acceptError: "Something went wrong. Please try again.",
    codeTitle: "You're all set",
    codeSubtitle: "Your referral code is now active. Share it with friends and family.",
    copy: "Copy",
    copied: "Copied",
    linkLabel: "Your referral link",
    shareHeading: "Ready-to-share messages",
    shareWhatsapp:
      "Moving or decluttering? I use EcoStorage for storage in Singapore. Use my code {code} when you enquire and get 1 month free on a 4-month plan: {link}\n(I may earn a referral reward.)",
    shareSocial:
      "Storage tip for Singapore 🏠 EcoStorage picks up, stores and delivers back. Code {code} = 1 month free on a 4-month plan. #affiliate {link}",
    disclosureReminder:
      "Always say that you may earn a reward when you share publicly. It's part of the agreement and the law.",
    toDashboard: "Go to my dashboard",
  },
};

export type Dictionary = typeof en;

const zhHans: Dictionary = {
  localeName: "中文",
  common: {
    signOut: "退出登录",
    language: "语言",
  },
  login: {
    title: "EcoStorage 推广伙伴",
    subtitle: "登录您的推广伙伴账户。",
    email: "电子邮箱",
    password: "密码",
    submit: "登录",
    submitting: "正在登录...",
    error: "邮箱或密码错误。",
  },
  dashboard: {
    greeting: "{name}，您好",
    subtitle: "您的推荐记录与佣金。",
    codeHeading: "您的推荐码",
    active: "已启用",
    inactive: "未启用",
    noCode: "暂无推荐码。",
    referralsHeading: "推荐记录",
    noReferrals: "暂无推荐记录。分享您的链接即可开始。",
    columns: {
      name: "姓名",
      mobile: "手机",
      email: "邮箱",
      submitted: "提交日期",
      status: "状态",
      commission: "佣金",
    },
    signupStatus: {
      lead: "潜在客户",
      contacted: "已联系",
      customer: "已成为客户",
      moved_out: "已搬出",
      lost: "未成交",
    },
    commissionStatus: {
      pending: "待确认",
      qualified: "已达标",
      paid: "已支付",
      forfeited: "已失效",
      ineligible: "不符合资格",
    },
  },
  welcome: {
    step: "第 {n} 步，共 3 步",
    languageTitle: "欢迎加入 EcoStorage 推广伙伴计划",
    languagePrompt: "请选择您偏好的语言",
    continue: "继续",
    back: "返回",
    termsTitle: "推广伙伴协议",
    termsVersion: "版本 {version}",
    translationNotice:
      "本中文译本仅供参考，不具有法律约束力。仅英文版本具有法律约束力；如中英文版本有任何不一致，概以英文版本为准。",
    termsUnavailable: "推广伙伴协议尚未发布。账户可启用时，我们会通过电子邮件通知您。",
    agree: "本人已阅读并同意 EcoStorage 推广伙伴协议（版本 {version}）。",
    agreeGoverning: "本人理解，本中文译本仅供参考，仅英文版本具有法律约束力。",
    accept: "同意并启用推荐码",
    accepting: "正在启用...",
    acceptError: "出现问题，请重试。",
    codeTitle: "设置完成",
    codeSubtitle: "您的推荐码已启用，快分享给亲友吧。",
    copy: "复制",
    copied: "已复制",
    linkLabel: "您的推荐链接",
    shareHeading: "可直接分享的文案",
    shareWhatsapp:
      "要搬家或整理空间？我在新加坡用 EcoStorage 存放物品。咨询时使用我的推荐码 {code}，4 个月方案可享 1 个月免费：{link}\n（本人可能获得推荐奖励。）",
    shareSocial:
      "新加坡存储小贴士 🏠 EcoStorage 上门取件、存放、送回一站式服务。推荐码 {code}，4 个月方案享 1 个月免费。#推广 {link}",
    disclosureReminder: "公开分享时，请务必说明您可能获得推荐奖励。这是协议要求，也是法律要求。",
    toDashboard: "前往我的主页",
  },
};

export const dictionaries = { en, "zh-Hans": zhHans } as const;

export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
