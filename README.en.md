<p align="center"><img src="assets/banner.png" alt="OpenTaigi" width="100%"></p>

# OpenTaigi

OpenTaigi (咱來學台語, "Let's learn Taigi") is an interactive Taigi learning site for phone and desktop. It turns public materials from the Ministry of Education course 《咱來學臺灣閩南語》 and [Taiwanese-Corpus/Lan-Lai-Oh-Taigi](https://github.com/Taiwanese-Corpus/Lan-Lai-Oh-Taigi) into searchable lessons with practice and native-speaker audio.

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-0b6b50?style=flat-square" alt="License: Apache 2.0"></a>
  <a href="https://openformosa.github.io/OpenTaigi/"><img src="https://img.shields.io/badge/demo-try%20it-c64332?style=flat-square" alt="Demo"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A522.13-64584c?style=flat-square" alt="Node 22.13 or later">
  <a href="https://discord.gg/N4YnrjjcW7"><img src="https://img.shields.io/badge/Discord-join-17120d?style=flat-square" alt="Discord"></a>
</p>

<p align="center"><a href="README.md">繁體中文</a> · <b>English</b></p>

<p align="center">
  <a href="https://openformosa.github.io/OpenTaigi/">Open the site</a> · <a href="docs/design-system.md">Design system</a> · <a href="https://openformosa.com/community/">Community</a>
</p>

## Why

The Ministry of Education Taigi course is thorough, but it ships as a 217-page PDF. The PDF is hard to read on a phone, cannot be searched, and keeps audio separate from text.

OpenTaigi re-lays the course out as web pages. Audio for romanization and readings sits next to the matching syllable, example, or paragraph. Learners pick a route by level and practice with listening challenges and word-matching games.

## Quick start

1. Open <https://openformosa.github.io/OpenTaigi/>.
2. Choose a level: beginner, everyday, or advanced reading.
3. Tap any sentence to hear a native speaker.

For local development, see the next section.

## Installation

| Item | Requirement |
| --- | --- |
| Node.js | 22.13 or later |
| Python | Only to regenerate course data |

Local development:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run build:pages
```

Pushing to `main` deploys GitHub Pages through GitHub Actions.

## Usage

### Learning features

- Three levels with recommended routes.
- Hints, playback speed, reading size, and starting material adapt to the level.
- Switch between full hints, Tâi-lô hints, and challenge mode at any time.
- Listening challenges with native-speaker sentences, and word-matching games.
- Points, current streak, best streak, and answer counts are saved on your device.

### Course content

- Four stages: romanization, words, sentences, readings.
- Lessons are re-laid out by stage instead of copying the PDF layout.
- The full 217-page PDF is converted to searchable, selectable, reflowable HTML. Reading mode suits phones; original mode keeps the source layout.
- Full-text search over 840 everyday sentences with 16 topic filters.
- 852 corrected entries with headword, Tâi-lô, Mandarin, examples, and A/B native-speaker audio.
- Native audio, playback speed, and romanization or Mandarin hints.
- Random sentence practice, reading progress, and resume.

### Interface

- Desktop sidebar, page header navigation, and mobile bottom navigation share one design system.
- Responsive layout with automatic GitHub Pages deployment.

See [`docs/design-system.md`](docs/design-system.md) for interface rules and acceptance criteria.

### Regenerate course data

The source PDF contains hidden layers and clipped content, so ordinary text extractors cannot read it directly. `build_html_curriculum.py` uses PyMuPDF to read only the visible text layer, then writes data shared by the positioned and mobile reading views.

```bash
python -m pip install -r scripts/requirements-pdf.txt
python scripts/build_curriculum.py /path/to/Lan-Lai-Oh-Taigi --skip-render
python scripts/build_html_curriculum.py /path/to/Lan-Lai-Oh-Taigi
```

## Documentation

- [Design system and acceptance criteria](docs/design-system.md)

## Limitations

- Course content follows the original source. The site code does not change the original sentences, romanization, or audio.
- Learning progress lives only on your device and is lost when you switch devices or clear browser data.

## Contributing

OpenFormosa is a community project. Everyone can be a contributor.

- Questions and discussion: [Discord](https://discord.gg/N4YnrjjcW7) or the [community page](https://openformosa.com/community/)
- Bugs and ideas: [Issues](https://github.com/OpenFormosa/OpenTaigi/issues)
- Pull requests: read [CONTRIBUTING.md](https://github.com/OpenFormosa/openformosa.com/blob/main/CONTRIBUTING.md) first
- General contact: <hello@openformosa.com>
- Security: <security@openformosa.com> (please do not open a public issue)
- Code of conduct: [CODE_OF_CONDUCT.md](https://github.com/OpenFormosa/openformosa.com/blob/main/CODE_OF_CONDUCT.md); report to <conduct@openformosa.com>

## License

Code and original documentation in this repository are released under the [Apache License 2.0](LICENSE), © 2026 OpenFormosa contributors.

Ministry of Education course materials (sentences, romanization, audio) are not covered and remain under their original terms.

## Acknowledgements

Course materials come from the Ministry of Education course and the [Taiwanese-Corpus/Lan-Lai-Oh-Taigi](https://github.com/Taiwanese-Corpus/Lan-Lai-Oh-Taigi) collection. Compute and research support come from Taipei-1, NTU Speech Lab, and NTU SPML Lab. Thanks to everyone who opened an issue, sent a pull request, or joined the discussion.
