# 咱來學台語

把教育部《咱來學臺灣閩南語》與
[Taiwanese-Corpus/Lan-Lai-Oh-Taigi](https://github.com/Taiwanese-Corpus/Lan-Lai-Oh-Taigi)
公開資料整理成適合手機與電腦的互動式教學網站。

**網站：<https://openformosa.github.io/OpenTaigi/>**

## 學習功能

- 初學起步、生活應用、進階讀寫三種程度與推薦路線
- 依程度自動調整提示量、播放速度、閱讀字級與起始教材
- 完整提示、台羅提示、挑戰模式可隨時手動切換
- 217 頁 PDF 全文轉成可搜尋、可選取、可重排的 HTML
- 閱讀模式適合手機，原版模式保留來源文字的位置與比例
- 840 句生活台語全文搜尋與 16 類主題篩選
- 真人發音、播放速度、羅馬字與華語提示切換
- 隨機語句練習、頁面閱讀進度與繼續閱讀
- 852 個校正後的語詞、台羅、華語與例詞
- 拼音、語詞、語句、文章四階段教材入口
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

## 重新產生教材資料

原 PDF 含隱藏圖層與裁切內容，不能用一般文字擷取器直接讀取。
`build_html_curriculum.py` 使用 PyMuPDF 只讀取實際顯示的文字層，
再輸出定位版與手機閱讀版共用的資料。

```bash
python -m pip install -r scripts/requirements-pdf.txt
python scripts/build_curriculum.py /path/to/Lan-Lai-Oh-Taigi --skip-render
python scripts/build_html_curriculum.py /path/to/Lan-Lai-Oh-Taigi
```

## 資料來源

教材著作權與授權依原始來源為準。網站程式不更動原始語句、羅馬字與音檔內容。
