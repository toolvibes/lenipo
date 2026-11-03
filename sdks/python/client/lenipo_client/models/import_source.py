from enum import StrEnum

class ImportSource(StrEnum):
    ARCHIVE = "archive"
    CONFLUENCE = "confluence"
    JIRA = "jira"

    def __str__(self) -> str:
        return str(self.value)
