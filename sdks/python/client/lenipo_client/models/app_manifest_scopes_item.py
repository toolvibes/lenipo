from enum import StrEnum

class AppManifestScopesItem(StrEnum):
    ISSUESREAD = "issues:read"
    ISSUESWRITE = "issues:write"
    WIKIREAD = "wiki:read"
    WIKIWRITE = "wiki:write"

    def __str__(self) -> str:
        return str(self.value)
