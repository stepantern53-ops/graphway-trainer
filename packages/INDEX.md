# packages/ - общие пакеты GraphWay

- `math-core/INDEX.md` - pure TS рациональный ввод, точные условия, контакты кругов/полиномов и безопасный маршрут, общий browser/server.
- `contracts/INDEX.md` - единые strict Zod schemas и публичные DTO.
- `curriculum/INDEX.md` - все24 урока graphway-v1 и школьная теория; witnesses только в tests.

Единый lockfile/npm workspaces на корне; пакет math-core не зависит от server/DOM/PG.
