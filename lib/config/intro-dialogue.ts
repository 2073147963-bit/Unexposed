// 「三重脑」开场对话 —— 未显影 UNEXPOSED 的开场独白。
// 三个脑层依次醒来，用哲学家的口吻争论「遗忘」；对话结束后进入桌面程序。
// 台词预生成（非实时推理），保证零延迟、可靠呈现；正文跟随语言模式中英双语。

export const INTRO_DIALOGUE_KEY = "introDialogueSeen";
export const INTRO_DIALOGUE_VERSION_KEY = "introDialogueVersion";
export const INTRO_DIALOGUE_VERSION = "triune-brain-v3";

export type IntroBrain = "reptilian" | "limbic" | "neocortex";

export type IntroStep =
  | { kind: "first" } // 首句：花体英文居中 + coco 出处（中文模式底部加斜体字幕）
  | { kind: "direction"; zh: string; en: string } // 舞台指示（小字斜体灰）
  | { kind: "line"; brain: IntroBrain; zh: string; en: string } // 某脑层的一句台词
  | { kind: "ending" }; // 收尾：未显影 UNEXPOSED 品牌卡

export const INTRO_BRAIN_NAMES: Record<IntroBrain, { zh: string; en: string }> = {
  reptilian: { zh: "古老的爬虫脑", en: "THE ANCIENT REPTILIAN BRAIN" },
  limbic: { zh: "疯狂的哺乳脑", en: "THE MAD LIMBIC BRAIN" },
  neocortex: { zh: "冷静的新皮层", en: "THE COLD NEOCORTEX" },
};

export const INTRO_FIRST_LINE = {
  en: "Death is not the end of life, forgetting is.",
  zh: "死亡不是终点，遗忘才是",
  attribution: "coco",
};

export const INTRO_ENDLINE = {
  zh: "封存那些还没死、却快被遗忘的。",
  en: "Seal what is not yet dead, but nearly forgotten.",
};

export const INTRO_STEPS: IntroStep[] = [
  { kind: "first" },

  { kind: "direction", zh: "短暂的黑暗中，头脑深处，三个声音依次醒来。", en: "In the brief dark, deep inside the mind, three voices wake, one by one." },

  { kind: "direction", zh: "声音从脊髓尽头爬出来。低沉，干冷，像某种古老动物贴着地面呼吸。", en: "A voice crawls up from the end of the spinal cord. Low, dry-cold, like some ancient animal breathing against the ground." },
  { kind: "line", brain: "reptilian", zh: "遗忘不是病。", en: "Forgetting is not a sickness." },
  { kind: "line", brain: "reptilian", zh: "是这具身体替你咬断了疼痛。", en: "It is this body, biting through your pain for you." },
  { kind: "line", brain: "reptilian", zh: "它知道，有些东西记得太久，会像碎玻璃留在肉里。于是它让面孔变淡，让声音走远，让那一天慢慢失去气味。", en: "It knows that some things, remembered too long, stay in the flesh like broken glass. So it lets the face fade, lets the voice drift away, lets that day slowly lose its smell." },
  { kind: "line", brain: "reptilian", zh: "它替你忘。它替你活。", en: "It forgets for you. It lives for you." },

  { kind: "direction", zh: "一团温热而迟疑的声音从胸腔升起。像一次没有得到回应的呼唤。", en: "A warm, hesitant voice rises from the chest. Like a call that was never answered." },
  { kind: "line", brain: "limbic", zh: "可身体并没有真正忘记。", en: "But the body has not truly forgotten." },
  { kind: "line", brain: "limbic", zh: "它会在经过某条旧街时突然放慢脚步，会在听见一个相似的名字时收紧喉咙，会在梦里回到一扇早已不存在的门前。", en: "It slows its step on some old street. Its throat tightens at a name that sounds the same. It walks in dreams back to a door that no longer exists." },
  { kind: "line", brain: "limbic", zh: "你只是忘了，自己为什么难过。", en: "You have only forgotten why you were sad." },

  { kind: "direction", zh: "声音从头颅高处落下。清醒、锋利，每句话都像刀尖划开一层雾。", en: "A voice drops from the top of the skull. Sober, sharp, each sentence like a blade cutting through fog." },
  { kind: "line", brain: "neocortex", zh: "能够遗忘，是一种力量。", en: "To be able to forget is a kind of strength." },
  { kind: "line", brain: "neocortex", zh: "一个记住全部的人，将被过去压得无法行动。", en: "A man who remembers everything will be crushed, unable to move, by his past." },
  { kind: "line", brain: "neocortex", zh: "可把一切都交给相册，也不是记忆。那只是囤积。成千上万张照片彼此遮蔽，直到没有一张仍然重要。", en: "But handing everything to an album is not memory, either. It is hoarding. Thousands of photographs, burying one another, until none of them matters." },

  { kind: "line", brain: "limbic", zh: "那么，我们应该忘记什么？", en: "Then what should we forget?" },
  { kind: "line", brain: "neocortex", zh: "你问错了。", en: "You are asking the wrong question." },
  { kind: "line", brain: "neocortex", zh: "真正的问题是——你愿意选择什么？", en: "The real question is — what are you willing to choose?" },

  { kind: "direction", zh: "它发出一声很轻的嗤笑。", en: "A very soft sneer." },
  { kind: "line", brain: "reptilian", zh: "选择。又一种让痛苦显得高贵的说法。", en: "Choice. Another word to make pain look noble." },
  { kind: "line", brain: "reptilian", zh: "记住一个人，不能让他回来。记住一段过去，也不能让你重新活一次。", en: "Remembering a person does not bring him back. Remembering a past does not let you live it twice." },

  { kind: "line", brain: "limbic", zh: "可如果不再有人想起，那些事情就会在仍然存在的时候，提前消失。", en: "But if no one remembers, those things will disappear while they still exist." },
  { kind: "line", brain: "limbic", zh: "一顿普通的晚餐。一次没有说出口的道别。某个人望向你时，眼睛里短暂出现的光。", en: "An ordinary dinner. A goodbye never spoken. A brief light in someone's eyes as they looked at you." },
  { kind: "line", brain: "limbic", zh: "它们没有死。", en: "They are not dead." },
  { kind: "line", brain: "limbic", zh: "只是你已经很久没有回头。", en: "You have simply not looked back for a long time." },

  { kind: "direction", zh: "一阵安静。", en: "A silence." },

  { kind: "line", brain: "neocortex", zh: "因此，不要保存全部。", en: "Therefore, do not keep everything." },
  { kind: "line", brain: "neocortex", zh: "全部，是另一种形式的遗忘。", en: "Everything is another kind of forgetting." },
  { kind: "line", brain: "neocortex", zh: "从无数个瞬间里，亲自指出几个。承认它们曾经改变过你。为自己的选择负责。", en: "Choose, with your own hand, a few from the countless moments. Admit that they once changed you. Take responsibility for your choice." },

  { kind: "line", brain: "reptilian", zh: "几个？", en: "A few?" },
  { kind: "line", brain: "neocortex", zh: "三个。", en: "Three." },
  { kind: "line", brain: "neocortex", zh: "足够构成一段记忆。", en: "Enough to form a memory." },
  { kind: "line", brain: "neocortex", zh: "也少到让你无法逃避选择。", en: "And few enough that you cannot escape the choosing." },

  { kind: "line", brain: "limbic", zh: "三张照片。", en: "Three photographs." },
  { kind: "line", brain: "limbic", zh: "还有三句，当时的你愿意留下的话。", en: "And three lines you were willing to write, back then." },
  { kind: "line", brain: "limbic", zh: "不是照片里有什么。", en: "Not what is in the photograph." },
  { kind: "line", brain: "limbic", zh: "而是它曾经怎样改变过你。", en: "But how it once changed you." },

  { kind: "direction", zh: "三个声音沉入黑暗。一张桌子，慢慢亮起来。", en: "The three voices sink into the dark. A desk slowly lights up." },

  { kind: "ending" },
];
