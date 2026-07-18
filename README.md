# 咱來學台語

把教育部《咱來學臺灣閩南語》與
[Taiwanese-Corpus/Lan-Lai-Oh-Taigi](https://github.com/Taiwanese-Corpus/Lan-Lai-Oh-Taigi)
公開資料整理成適合手機與電腦的互動式教學網站。

**網站：<https://eric-lam.com/OpenTaigi/>**

## 學習功能

- 840 句生活台語全文搜尋與 16 類主題篩選
- 真人發音、播放速度、羅馬字與華語提示切換
- 隨堂選擇題、收藏與學習進度
- 拼音、語詞、語句、文章四階段原始教材入口
- 響應式版面與 GitHub Pages 自動部署

## 本機開發

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
npm run build:pages
```

推送到 `main` 後，GitHub Actions 會自動發佈 GitHub Pages。

## 資料來源

教材著作權與授權依原始來源為準。網站程式不更動原始語句、羅馬字與音檔內容。
