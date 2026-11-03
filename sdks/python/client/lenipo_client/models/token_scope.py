from enum import StrEnum

class TokenScope(StrEnum):
    ADMIN = "admin"
    ISSUESREAD = "issues:read"
    ISSUESWRITE = "issues:write"
    WIKIREAD = "wiki:read"
    WIKIWRITE = "wiki:write"

    def __str__(self) -> str:
        return str(self.value)
