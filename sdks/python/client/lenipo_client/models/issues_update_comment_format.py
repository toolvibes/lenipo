from enum import StrEnum

class IssuesUpdateCommentFormat(StrEnum):
    JSON = "json"
    MARKDOWN = "markdown"

    def __str__(self) -> str:
        return str(self.value)
