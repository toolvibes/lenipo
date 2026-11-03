from enum import StrEnum

class IssuesGetFormat(StrEnum):
    JSON = "json"
    MARKDOWN = "markdown"

    def __str__(self) -> str:
        return str(self.value)
