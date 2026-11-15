import { describe, expect, it } from "vite-plus/test";
import {
  UNSORTED_CATEGORY_ID,
  classifyThread,
  parseCategoryOverrides,
  resolveThreadCategory,
} from "./threadCategories";

const classify = (title: string, projectName = "自媒体") => classifyThread({ title, projectName });

describe("classifyThread", () => {
  it("puts account and platform words ahead of generic topics", () => {
    expect(classify("公众号日更和爆火策略")).toBe("wechat");
    expect(classify("小红书小岛经济学流量异常")).toBe("xiaodao");
    expect(classify("真人主号封面与主页视觉方向")).toBe("douyin-real");
    expect(classify("AI时代普通人的机会：配乐筛选")).toBe("douyin-ai");
    expect(classify("Claude视频抖音发布与封面方案续2")).toBe("douyin-other");
    expect(classify("T3 工作台 X 文章：自媒体实战与软件对比")).toBe("x");
    expect(classify("优化 X 账号主页简介")).toBe("x");
  });
  it("sorts business and tool conversations", () => {
    expect(classify("核心股错杀提醒｜港股盘中", "交易")).toBe("invest");
    expect(classify("评估劳动合同风险与优化", "公司管理")).toBe("company");
    expect(classify("粒粒创意海报｜KV 两张图验收", "项目管理")).toBe("client");
    expect(classify("T3 面板交接", "AI 工作台")).toBe("t3");
    expect(classify("内外盘清理与 T3 Code 升级评估", "AI 工作台")).toBe("t3");
    expect(classify("排查电脑与手机 VPN 网速", "AI 工作台")).toBe("devices");
    expect(classify("排查 Claude 额度骤耗原因并修复", "AI 工作台")).toBe("models");
    expect(classify("Obsidian 项目沉淀与定时同步优化", "AI 工作台")).toBe("automation");
  });
  it("falls back to the project, and leaves topic-less dumps unsorted", () => {
    expect(classify("淘宝运营")).toBe("product");
    expect(classify("自媒体赚钱运营。")).toBe("content-other");
    expect(classify("聊聊最近的状态", "AI 工作台")).toBe("tools-other");
    expect(classify('<image name=[Image #1] path="/tmp/x.png">', "未归类历史")).toBe(
      UNSORTED_CATEGORY_ID,
    );
    expect(classify("Call your built-in image generation tool exactly once", "自媒体")).toBe(
      UNSORTED_CATEGORY_ID,
    );
    expect(classify("请你试图说服他", "项目管理")).toBe(UNSORTED_CATEGORY_ID);
  });
});

describe("category overrides", () => {
  it("keeps only known categories from stored data", () => {
    expect(parseCategoryOverrides(null)).toEqual({});
    expect(parseCategoryOverrides("{")).toEqual({});
    expect(parseCategoryOverrides("[]")).toEqual({});
    expect(parseCategoryOverrides('{"a":"wechat","b":"nope","c":3}')).toEqual({ a: "wechat" });
  });
  it("lets a manual choice win over the automatic rule", () => {
    const input = { title: "公众号日更", projectName: "自媒体" };
    expect(resolveThreadCategory({}, "k", input)).toBe("wechat");
    expect(resolveThreadCategory({ k: "x" }, "k", input)).toBe("x");
  });
});
