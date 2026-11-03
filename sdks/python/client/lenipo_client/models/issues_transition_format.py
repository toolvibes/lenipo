from enum import StrEnum

class IssuesTransitionFormat(StrEnum):
    JSON = "json"
    MARKDOWN = "markdown"

    def __str__(self) -> str:
        return str(self.value)
