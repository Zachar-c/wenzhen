# 问真

离线网页策略肉鸽。直接打开 [lab.html](lab.html)，无需安装或联网。

新界面提供命途、交锋、蛊藏、整备与交易、修行、行记和往昔行卷。蛊藏与修行可独立查看；买卖、疗伤、锻体与突破在整备期间进行。保留原有玩法、自动存档与旧录。

首版明确不做蛊虫食料、炼蛊合成和杀招系统。蛊虫通过敌人战利、商店买卖、奇遇与遗藏取得，直接进入蛊仓；单蛊催用、拳脚、锻体、疗伤和修为成长构成正式玩法。

小突破与大突破均增加真元上限，突破前显示实际收益，不免费补满当前真元。点数折算可用储备，容量曲线属于游戏适配；四小境界与真元品质依据核验 Wiki，不能把点数视为原著元海比例。回复速度保持原值，活跃旧档重算敌我容量并保留当前资源，已结束局的旧录保持原记录。

普通旅途整备随机上架部分商品；专门市集供应本段已解锁的全部商品，便于围绕月道、血月或力道自疗定向购蛊。价格、转数催用条件和每处商品售罄规则不变。

正式名单为19只蛊虫，另有1项原创资质机缘道具。名单见 [release_gu.json](data/release_gu.json)：攻击与辅助、防护、锻体与苦力、治疗、舍利晋阶均有用途；覆盖一至五转，五转目前为紫晶舍利成长用途，不宣称已有五转攻击蛊。原著能力与转数核对Wiki；数值、价格、遗藏内容及取得代价为游戏适配。

- 正式入口：`lab.html`、`js/`、`css/`、`assets/`。
- 改 `data/` 后运行 `node tools/build_data.mjs`，生成 `js/data.js`。
- 当前要求见 [产品需求](docs/PRODUCT_REQUIREMENTS.md)，历史数值和实施记录不覆盖最新首版范围。
- 当前检查运行 `node --test tests/first_release.test.mjs tests/first_release_browser.test.mjs tests/ui_integration_browser.test.mjs tests/growth.test.mjs tests/bitter_save.test.mjs tests/enemy_essence.test.mjs`。旧食料、合炼、杀招测试是历史记录，不属于现版验收。
- 发行包运行 `node tools/package_lab.mjs --out <不存在的新目录>`。

已有库存与旧存档保留；旧未炼化库存迁入蛊仓，历史缺粮不再阻止催用。历史蛊虫保留仓库查看与出售，新掉落和商店只使用正式名单。

本仓从旧主实现提取；[EXTRACTION.json](EXTRACTION.json)记录提取来源与哈希，不代表后续改动。换目录后浏览器存档不会自动迁移。提取验证和局部规则测试均不能代替成品体验验收。

MIT许可见 [LICENSE](LICENSE)。字体与GSAP许可随文件保留；其他素材不因提取获得新的授权。
